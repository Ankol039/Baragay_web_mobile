<?php
/** Address-aware residency transitions from the original page, serialized on the resident row. */
function api_staff_resident_promote(mysqli $conn, array $input): void {
    $conn->begin_transaction();
    try {
        $rid = (int)($input['resident_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');
        $lookup = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? LIMIT 1 FOR UPDATE");
        $lookup->bind_param('i', $rid);
        $lookup->execute();
        $person = $lookup->get_result()->fetch_assoc();
        $lookup->close();
        $duration = $person ? residency_duration($person['residency_start_date'] ?? '') : null;
        if (!$person) {
            $error = 'Resident not found.';
        } elseif (($person['residency_status'] ?? '') !== 'temporary') {
            $error = 'That resident is already permanent.';
        } elseif (trim((string)($person['temp_household_number'] ?? '')) === ''
                  && trim((string)($person['temporary_address'] ?? '')) === '') {
            $error = 'This resident has no temporary address on file, so there is nothing to promote. Edit their record first.';
        } elseif ($duration === null) {
            $error = 'Set a valid "Residing Here Since" date on this resident before making them permanent.';
        } elseif ($duration['total_months'] < permanent_residency_min_months()) {
            $error = 'This resident has stayed only ' . format_residency_duration($duration)
                . '. They must reach ' . permanent_residency_min_months() . ' months before being made permanent.';
        } else {

            $log = $conn->prepare("INSERT INTO resident_residency_changes
                    (resident_id, from_status, to_status, reason, changed_by,
                     prev_address, prev_household_number, prev_purok, prev_street_highway,
                     prev_barangay, prev_municipality, prev_postal_code, prev_province,
                     prev_temporary_address, prev_temp_household_number, prev_temp_purok,
                     prev_temp_street_highway, prev_temp_barangay, prev_temp_municipality,
                     prev_temp_postal_code, prev_temp_province, prev_residence_type)
                VALUES (?, 'temporary', 'permanent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $changed_by = $_SESSION['staff_id'] ?? null;
            $log->bind_param('isi' . str_repeat('s', 17),
                $rid, $reason, $changed_by,
                $person['address'], $person['household_number'], $person['purok'], $person['street_highway'],
                $person['barangay'], $person['municipality'], $person['postal_code'], $person['province'],
                $person['temporary_address'], $person['temp_household_number'], $person['temp_purok'],
                $person['temp_street_highway'], $person['temp_barangay'], $person['temp_municipality'],
                $person['temp_postal_code'], $person['temp_province'], $person['residence_type']);
            $log->execute();
            $log->close();
            $promoted_address = build_address_line(
                $person['temp_household_number'], $person['temp_purok'], $person['temp_street_highway'],
                $person['temp_barangay'], $person['temp_municipality'], $person['temp_postal_code'],
                $person['temp_province']
            );
            if ($promoted_address === '') {
                $promoted_address = (string)($person['temporary_address'] ?? '');
            }
            $apply = $conn->prepare("UPDATE residents SET
                    residency_status = 'permanent',
                    household_number = ?, purok = ?, street_highway = ?, barangay = ?,
                    municipality = ?, postal_code = ?, province = ?, address = ?,
                    temporary_address = NULL, temp_household_number = NULL, temp_purok = NULL,
                    temp_street_highway = NULL, temp_barangay = NULL, temp_municipality = NULL,
                    temp_postal_code = NULL, temp_province = NULL, residence_type = NULL
                WHERE resident_id = ?");
            $apply->bind_param('ssssssssi',
                $person['temp_household_number'], $person['temp_purok'], $person['temp_street_highway'],
                $person['temp_barangay'], $person['temp_municipality'], $person['temp_postal_code'],
                $person['temp_province'], $promoted_address, $rid);
            $apply->execute();
            $apply->close();
            $conn->commit();
            $message = trim($person['first_name'] . ' ' . $person['last_name'])
                . ' is now a permanent resident. Their previous address is kept in Residency Records.';
        }

        if (isset($error)) api_staff_resident_failure($conn, $error);
        api_staff_resident_success($message);
    } catch (Throwable $failure) {
        api_staff_resident_failure($conn, 'The system is temporarily unavailable. Please try again in a few minutes.', 500);
    }
}
function api_staff_resident_revert(mysqli $conn, array $input): void {
    $conn->begin_transaction();
    try {
        $rid = (int)($input['resident_id'] ?? 0);
        $reason = trim($input['reason'] ?? '');
        $lookup = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? LIMIT 1 FOR UPDATE");
        $lookup->bind_param('i', $rid);
        $lookup->execute();
        $person = $lookup->get_result()->fetch_assoc();
        $lookup->close();
        $history = $conn->prepare("SELECT * FROM resident_residency_changes
            WHERE resident_id = ? AND to_status = 'permanent' AND is_reverted = 0
            ORDER BY changed_at DESC, change_id DESC LIMIT 1");
        $history->bind_param('i', $rid);
        $history->execute();
        $promotion = $history->get_result()->fetch_assoc();
        $history->close();
        if (!$person) {
            $error = 'Resident not found.';
        } elseif (($person['residency_status'] ?? '') !== 'permanent') {
            $error = 'That resident is already temporary.';
        } elseif ($reason === '') {
            $error = 'Give a reason before reverting someone to temporary. It is kept on the record.';
        } else {

            if ($promotion) {
                $restored_temp_address = build_address_line(
                    $person['household_number'], $person['purok'], $person['street_highway'],
                    $person['barangay'], $person['municipality'], $person['postal_code'], $person['province']
                );
                if ($restored_temp_address === '') {
                    $restored_temp_address = (string)($person['address'] ?? '');
                }
                $apply = $conn->prepare("UPDATE residents SET
                        residency_status = 'temporary',
                        household_number = ?, purok = ?, street_highway = ?, barangay = ?,
                        municipality = ?, postal_code = ?, province = ?, address = ?,
                        temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                        temp_municipality = ?, temp_postal_code = ?, temp_province = ?, temporary_address = ?,
                        residence_type = ?
                    WHERE resident_id = ?");
                $restored_residence_type = array_key_exists((string)$promotion['prev_residence_type'], residence_types())
                    ? $promotion['prev_residence_type']
                    : '';
                $apply->bind_param(str_repeat('s', 17) . 'i',
                    $promotion['prev_household_number'], $promotion['prev_purok'], $promotion['prev_street_highway'],
                    $promotion['prev_barangay'], $promotion['prev_municipality'], $promotion['prev_postal_code'],
                    $promotion['prev_province'], $promotion['prev_address'],
                    $person['household_number'], $person['purok'], $person['street_highway'], $person['barangay'],
                    $person['municipality'], $person['postal_code'], $person['province'], $restored_temp_address,
                    $restored_residence_type, $rid);
                $apply->execute();
                $apply->close();
                $close = $conn->prepare("UPDATE resident_residency_changes SET is_reverted = 1 WHERE change_id = ?");
                $close->bind_param('i', $promotion['change_id']);
                $close->execute();
                $close->close();
            } else {
                $carried_address = build_address_line(
                    $person['household_number'], $person['purok'], $person['street_highway'],
                    $person['barangay'], $person['municipality'], $person['postal_code'], $person['province']
                );
                if ($carried_address === '') {
                    $carried_address = (string)($person['address'] ?? '');
                }
                $apply = $conn->prepare("UPDATE residents SET
                        residency_status = 'temporary',
                        temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                        temp_municipality = ?, temp_postal_code = ?, temp_province = ?, temporary_address = ?,
                        residence_type = ''
                    WHERE resident_id = ?");
                $apply->bind_param('ssssssssi',
                    $person['household_number'], $person['purok'], $person['street_highway'], $person['barangay'],
                    $person['municipality'], $person['postal_code'], $person['province'], $carried_address, $rid);
                $apply->execute();
                $apply->close();
            }
            $log = $conn->prepare("INSERT INTO resident_residency_changes
                    (resident_id, from_status, to_status, reason, changed_by,
                     prev_address, prev_household_number, prev_purok, prev_street_highway,
                     prev_barangay, prev_municipality, prev_postal_code, prev_province,
                     prev_temporary_address, prev_temp_household_number, prev_temp_purok,
                     prev_temp_street_highway, prev_temp_barangay, prev_temp_municipality,
                     prev_temp_postal_code, prev_temp_province, prev_residence_type)
                VALUES (?, 'permanent', 'temporary', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $changed_by = $_SESSION['staff_id'] ?? null;
            $log->bind_param('isi' . str_repeat('s', 17),
                $rid, $reason, $changed_by,
                $person['address'], $person['household_number'], $person['purok'], $person['street_highway'],
                $person['barangay'], $person['municipality'], $person['postal_code'], $person['province'],
                $person['temporary_address'], $person['temp_household_number'], $person['temp_purok'],
                $person['temp_street_highway'], $person['temp_barangay'], $person['temp_municipality'],
                $person['temp_postal_code'], $person['temp_province'], $person['residence_type']);
            $log->execute();
            $log->close();
            $conn->commit();
            $needs_type = !$promotion
                || !array_key_exists((string)$promotion['prev_residence_type'], residence_types());
            $message = trim($person['first_name'] . ' ' . $person['last_name'])
                . ' has been returned to temporary resident status.'
                . ($needs_type ? ' Open their record and set the Type of Temporary Residence.' : '')
                . ($promotion ? '' : ' No archived address existed, so their address on file became the temporary one - enter their permanent address next.');
        }

        if (isset($error)) api_staff_resident_failure($conn, $error);
        api_staff_resident_success($message);
    } catch (Throwable $failure) {
        api_staff_resident_failure($conn, 'The system is temporarily unavailable. Please try again in a few minutes.', 500);
    }
}
