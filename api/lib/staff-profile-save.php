<?php
/** Source validation and updates; owning row lock serializes address requests. */
function api_staff_profile_save(mysqli $conn, array $user): void {
    if ($user['role'] === 'admin') api_error('Access denied.', 403);
    $staff_id = $user['id'];
    $input = api_input(array_merge(['contact_number', 'email', 'birthdate', 'gender', 'license_number',
        'emergency_contact_name', 'emergency_contact_number', 'reason'], address_field_names()));
    $error = ''; $outcome = 'normal';
    $conn->begin_transaction();
    try {
        $stmt = api_management_sql($conn, 'SELECT * FROM staff WHERE staff_id = ? FOR UPDATE', [$staff_id]);
        $account = $stmt->get_result()->fetch_assoc(); $stmt->close();
        $onboarding = (int)$account['profile_completed'] === 0;
        $stmt = api_management_sql($conn, "SELECT request_id FROM staff_update_requests WHERE staff_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE", [$staff_id]);
        $pending_request = $stmt->get_result()->fetch_assoc(); $stmt->close();
        $contact_number    = trim($input['contact_number'] ?? '');
        $email             = trim($input['email'] ?? '');
        $birthdate         = trim($input['birthdate'] ?? '');
        $gender            = trim($input['gender'] ?? '');
        $license_number    = trim($input['license_number'] ?? '');
        $emergency_contact_name   = trim($input['emergency_contact_name'] ?? '');
        $emergency_contact_number = trim($input['emergency_contact_number'] ?? '');
        // The old single-line column is kept in step so anything still reading it
        // does not go blank.
        $emergency_contact = trim($emergency_contact_name . ($emergency_contact_number !== '' ? ' - ' . $emergency_contact_number : ''));

        $household_number    = trim($input['household_number'] ?? '');
        $purok        = trim($input['purok'] ?? '');
        $street_highway = trim($input['street_highway'] ?? '');
        $barangay            = trim($input['barangay'] ?? '');
        $municipality        = trim($input['municipality'] ?? '');
        $postal_code         = trim($input['postal_code'] ?? '');
        $province            = trim($input['province'] ?? '');
        $reason              = trim($input['reason'] ?? '');

        $gender = array_key_exists($gender, gender_options()) ? $gender : '';
        $birthdate_value = $birthdate !== '' ? $birthdate : null;

        // Optional, so an empty box is stored as NULL rather than an empty
        // string — that way "no licence" and "not filled in yet" read the same
        // in the database instead of being two different kinds of nothing.
        $license_number_value = $license_number !== '' ? $license_number : null;

        $new_address = build_address_line(
            $household_number, $purok, $street_highway,
            $barangay, $municipality, $postal_code, $province
        );

        // After onboarding the address is under review, so the form no longer
        // sends it. Keep what is on file rather than reading blanks back in.
        $address_locked = !$onboarding && $pending_request !== null;
        $address_changed = !$onboarding && !$address_locked && $new_address !== (string)$account['address'];

        if ($contact_number === '') {
            $error = 'Contact number is required.';
        } elseif (!preg_match('/^[0-9+()\-\s]{7,20}$/', $contact_number)) {
            $error = 'Enter a contact number using digits, spaces, and + ( ) - only.';
        } elseif ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Enter a valid email address, or leave the field blank.';
        } elseif ($birthdate !== '' && $birthdate >= date('Y-m-d')) {
            $error = 'Birthdate must be in the past.';
        } elseif ($license_number !== '' && mb_strlen($license_number) > 50) {
            $error = 'That license number is too long (50 characters maximum).';
        } elseif ($license_number !== '' && !preg_match('/^[A-Za-z0-9\-\s\/]+$/', $license_number)) {
            $error = 'Enter a license number using letters, digits, spaces, and - / only.';
        } elseif ($emergency_contact_number !== '' && !preg_match('/^[0-9+()\-\s]{7,20}$/', $emergency_contact_number)) {
            $error = 'Enter an emergency contact number using digits, spaces, and + ( ) - only.';
        } elseif (!$address_locked && ($household_number === '' || $barangay === '' || $municipality === '' || $province === '')) {
            $error = 'Household Number, Barangay, Municipality/City, and Province are required.';
        } elseif (!$address_locked && $postal_code !== '' && !preg_match('/^\d{4}$/', $postal_code)) {
            $error = 'A Philippine postal code is four digits.';
        } elseif ($address_changed && $reason === '') {
            $error = 'Give a short reason for the address change so the administrator can act on it.';
        } else {
            // Contact details are the staff member's own and save immediately.
            $stmt = $conn->prepare(
                "UPDATE staff
                    SET contact_number = ?, email = ?, birthdate = ?, gender = ?, license_number = ?,
                        emergency_contact = ?, emergency_contact_name = ?, emergency_contact_number = ?,
                        profile_completed = 1
                  WHERE staff_id = ?"
            );
            $stmt->bind_param('ssssssssi', $contact_number, $email, $birthdate_value, $gender, $license_number_value,
                $emergency_contact, $emergency_contact_name, $emergency_contact_number, $staff_id);
            $stmt->execute();
            $stmt->close();

            if ($onboarding) {
                // First time through: the address is being recorded, not changed.
                $stmt = $conn->prepare(
                    "UPDATE staff
                        SET address = ?, household_number = ?, purok = ?, street_highway = ?,
                            barangay = ?, municipality = ?, postal_code = ?, province = ?
                      WHERE staff_id = ?"
                );
                $stmt->bind_param(
                    'ssssssssi',
                    $new_address, $household_number, $purok, $street_highway,
                    $barangay, $municipality, $postal_code, $province, $staff_id
                );
                $stmt->execute();
                $stmt->close();

                $outcome = 'first';
            } elseif ($address_changed) {
                // Every later change is reviewed. Nothing on the staff row moves
                // until an administrator approves it.
                $stmt = $conn->prepare(
                    "INSERT INTO staff_update_requests
                        (staff_id, staff_number, staff_name, household_number, purok, street_highway,
                         barangay, municipality, postal_code, province, address, previous_address, reason)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                );
                $stmt->bind_param(
                    'issssssssssss',
                    $staff_id, $account['staff_number'], $account['full_name'],
                    $household_number, $purok, $street_highway,
                    $barangay, $municipality, $postal_code, $province,
                    $new_address, $account['address'], $reason
                );
                $stmt->execute();
                $stmt->close();

                $outcome = 'requested';
            } else {
                $outcome = 'normal';
            }

            $conn->commit();

        }

        if ($error !== '') { $conn->rollback(); api_error($error); }
    } catch (Throwable $failure) { $conn->rollback(); throw $failure; }
    api_json(['ok' => true, 'data' => api_staff_profile_data($conn, $user), 'outcome' => $outcome]);
}
