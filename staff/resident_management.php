<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Resident Management';
$asset_path = '../';
$error = '';
$message = '';
$form_had_error = false;
$editing_resident = null;
$editing_resident_id = 0;
/*
 * Which form failed, so the right one is reopened.
 *
 * $form_had_error alone drove the Add Resident modal, whichever form had been
 * submitted. A failed update therefore threw the person back to a blank Add
 * form with an "Add Resident" button, losing everything they had typed and
 * making it look as though editing had turned into creating.
 */
$failed_form = '';

// 1. Check for success messages in the session, assign it, and instantly delete it
if (isset($_SESSION['flash_success'])) {
    $message = $_SESSION['flash_success'];
    unset($_SESSION['flash_success']);
}

// Refused actions arrive the same way, so the reason survives the redirect
if (isset($_SESSION['flash_error'])) {
    $error = $_SESSION['flash_error'];
    unset($_SESSION['flash_error']);
}

// Reset a resident's password back to their resident number, and force change on next login
if (isset($_GET['reset'])) {
    $rid = (int)$_GET['reset'];
    $stmt = $conn->prepare("SELECT resident_number FROM residents WHERE resident_id = ?");
    $stmt->bind_param('i', $rid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row) {
        $hash = password_hash($row['resident_number'], PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE residents SET password = ?, is_first_login = 1 WHERE resident_id = ?");
        $stmt->bind_param('si', $hash, $rid);
        $stmt->execute();
        $stmt->close();

        // Use flash session and redirect to clean the URL
        $_SESSION['flash_success'] = "Password reset to default (resident number).";
        redirect('resident_management.php');
    }
}

/**
 * Delete a resident — administrators only.
 *
 * Deleting cascades to every survey response the resident submitted, so it
 * is the one action on this page that cannot be undone. Staff get the
 * reversible actions (deactivate, reset password) and raise a request when
 * a record genuinely has to go.
 */
if (isset($_GET['delete'])) {
    $rid = (int)$_GET['delete'];

    if (!staff_is_admin()) {
        // Server-side guard: staff never see the button, but hiding a
        // control is not the same as refusing the request.
        $_SESSION['flash_error'] = 'Only an administrator can delete a resident record. Use Request Deletion instead, or deactivate the account to block access without losing their survey history.';
        redirect('resident_management.php');
    }

    if ($rid > 0) {
        // Archive rather than DELETE. The old statement removed the row,
        // and the foreign key on `responses` took every survey answer with
        // it — one click, nothing recoverable. The account now moves to
        // Deleted Accounts, where an administrator can restore it.
        $lookup = $conn->prepare("SELECT first_name, last_name FROM residents WHERE resident_id = ? AND deleted_at IS NULL");
        $lookup->bind_param('i', $rid);
        $lookup->execute();
        $target = $lookup->get_result()->fetch_assoc();
        $lookup->close();

        $deleted = false;
        if ($target) {
            $deleted = archive_account($conn, 'residents', $rid,
                                       (int)$_SESSION['staff_id'],
                                       $_SESSION['staff_name'] ?? '',
                                       'Deleted from the Residents page.');
        }

        if ($deleted) {
            // Close out anything still pending for a resident who is no longer listed.
            $tidy = $conn->prepare("UPDATE resident_delete_requests
                                       SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?,
                                           review_comment = 'Deleted directly by an administrator.'
                                     WHERE resident_id = ? AND status = 'pending'");
            $reviewer_id = (int)$_SESSION['staff_id'];
            $reviewer_name = $_SESSION['staff_name'] ?? '';
            $tidy->bind_param('isi', $reviewer_id, $reviewer_name, $rid);
            $tidy->execute();
            $tidy->close();
        }

        $_SESSION['flash_success'] = $deleted
            ? 'Resident moved to Deleted Accounts. Their survey responses were kept, and you can restore the account from there.'
            : 'Resident could not be found.';
        redirect('resident_management.php');
    }
}

/**
 * Activate / deactivate a resident account.
 *
 * The reversible alternative to deletion, and the action staff are meant to
 * reach for. The account and all of its survey history stay intact; only
 * login is refused.
 */
if (isset($_GET['toggle'])) {
    $rid = (int)$_GET['toggle'];

    $stmt = $conn->prepare("SELECT is_active FROM residents WHERE resident_id = ? AND deleted_at IS NULL");
    $stmt->bind_param('i', $rid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $new_state = ((int)$row['is_active'] === 1) ? 0 : 1;
        $stmt = $conn->prepare("UPDATE residents SET is_active = ? WHERE resident_id = ?");
        $stmt->bind_param('ii', $new_state, $rid);
        $stmt->execute();
        $stmt->close();

        $_SESSION['flash_success'] = $new_state
            ? 'Resident account reactivated.'
            : 'Resident account deactivated. Their survey history has been kept.';
        redirect('resident_management.php');
    }
}

/**
 * Raise a deletion request — the staff route to removing a record.
 *
 * The request stores a snapshot of the resident's number and name so the
 * audit trail survives the deletion it authorises.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['request_delete'])) {
    $rid = (int)($_POST['resident_id'] ?? 0);
    $reason = trim($_POST['reason'] ?? '');

    if ($reason === '') {
        $error = 'Give a reason so the administrator can act on the request.';
    } else {
        $stmt = $conn->prepare("SELECT resident_number, first_name, last_name FROM residents WHERE resident_id = ? AND deleted_at IS NULL");
        $stmt->bind_param('i', $rid);
        $stmt->execute();
        $target = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$target) {
            $error = 'That resident could not be found.';
        } else {
            // One open request per resident is enough; a second would just
            // give the administrator the same decision twice.
            $stmt = $conn->prepare("SELECT 1 FROM resident_delete_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1");
            $stmt->bind_param('i', $rid);
            $stmt->execute();
            $already_pending = $stmt->get_result()->num_rows > 0;
            $stmt->close();

            if ($already_pending) {
                $_SESSION['flash_success'] = 'A deletion request for this resident is already waiting for the administrator.';
                redirect('resident_management.php');
            }

            $resident_name = preg_replace('/\s+/', ' ', trim($target['first_name'] . ' ' . $target['last_name']));
            $requested_by = (int)$_SESSION['staff_id'];
            $requested_by_name = $_SESSION['staff_name'] ?? '';

            $stmt = $conn->prepare("INSERT INTO resident_delete_requests
                                        (resident_id, resident_number, resident_name, reason, requested_by, requested_by_name)
                                    VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param('isssis', $rid, $target['resident_number'], $resident_name, $reason, $requested_by, $requested_by_name);
            $stmt->execute();
            $stmt->close();

            $_SESSION['flash_success'] = 'Deletion request sent to the administrator for ' . $resident_name . '. The account is untouched until they decide.';
            redirect('resident_management.php');
        }
    }
}

/**
 * Make a temporary resident permanent.
 *
 * The address they have actually been staying at becomes their permanent
 * address, and the address previously on file is archived to
 * resident_residency_changes. Nothing is destroyed: the archive is what
 * allows the move to be undone if the claim is later disproved.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['promote_resident']) && staff_is_admin()) {
    $rid = (int)($_POST['resident_id'] ?? 0);
    $reason = trim($_POST['reason'] ?? '');

    $lookup = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? LIMIT 1");
    $lookup->bind_param('i', $rid);
    $lookup->execute();
    $person = $lookup->get_result()->fetch_assoc();
    $lookup->close();

    $duration = $person ? residency_duration($person['residency_start_date'] ?? '') : null;

    if (!$person) {
        $_SESSION['flash_error'] = 'Resident not found.';
    } elseif (($person['residency_status'] ?? '') !== 'temporary') {
        $_SESSION['flash_error'] = 'That resident is already permanent.';
    } elseif (trim((string)($person['temp_household_number'] ?? '')) === ''
              && trim((string)($person['temporary_address'] ?? '')) === '') {
        $_SESSION['flash_error'] = 'This resident has no temporary address on file, so there is nothing to promote. Edit their record first.';
    } elseif ($duration === null) {
        $_SESSION['flash_error'] = 'Set a valid "Residing Here Since" date on this resident before making them permanent.';
    } elseif ($duration['total_months'] < permanent_residency_min_months()) {
        $_SESSION['flash_error'] = 'This resident has stayed only ' . format_residency_duration($duration)
            . '. They must reach ' . permanent_residency_min_months() . ' months before being made permanent.';
    } else {
        $conn->begin_transaction();

        // 1. Archive both addresses exactly as they stand right now.
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

        // 2. The temporary address moves up and the temporary fields clear,
        //    which is also what removes the section from the resident's own
        //    profile: those pages key off residency_status and temp_*.
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
        $_SESSION['flash_success'] = trim($person['first_name'] . ' ' . $person['last_name'])
            . ' is now a permanent resident. Their previous address is kept in Residency Records.';
    }
    redirect('resident_management.php');
}

/**
 * Put a permanent resident back to temporary.
 *
 * Used when a promotion turns out to have been granted on false information.
 * The most recent un-reverted promotion is replayed backwards, so both
 * addresses return to exactly what they were before it.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['revert_resident']) && staff_is_admin()) {
    $rid = (int)($_POST['resident_id'] ?? 0);
    $reason = trim($_POST['reason'] ?? '');

    $lookup = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? LIMIT 1");
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
        $_SESSION['flash_error'] = 'Resident not found.';
    } elseif (($person['residency_status'] ?? '') !== 'permanent') {
        $_SESSION['flash_error'] = 'That resident is already temporary.';
    } elseif ($reason === '') {
        $_SESSION['flash_error'] = 'Give a reason before reverting someone to temporary. It is kept on the record.';
    } else {
        $conn->begin_transaction();

        if ($promotion) {
            // Undo a promotion: the archived permanent address comes back,
            // and the address they are living at returns to temporary.
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
            // Codes are two letters (AR, DR, BH...). If the archive has none,
            // leave it blank rather than inventing a value; the admin is told
            // to set it in the flash message below.
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
            // Never promoted through this screen - they were registered as
            // permanent. There is no earlier address to restore, so the one
            // on file becomes the temporary address and the permanent one is
            // left for staff to fill in.
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

        // The reversion is itself part of the record.
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

        // Warn when the record now needs a residence type filled in, rather
        // than leaving the admin to discover it on the next edit.
        $needs_type = !$promotion
            || !array_key_exists((string)$promotion['prev_residence_type'], residence_types());
        $_SESSION['flash_success'] = trim($person['first_name'] . ' ' . $person['last_name'])
            . ' has been returned to temporary resident status.'
            . ($needs_type ? ' Open their record and set the Type of Temporary Residence.' : '')
            . ($promotion ? '' : ' No archived address existed, so their address on file became the temporary one - enter their permanent address next.');
    }
    redirect('resident_management.php');
}

/*
 * The "quick update residency status" endpoint was removed.
 *
 * It wrote residents.residency_status directly from a posted value, with no
 * address handling and no entry in Residency Records — the same silent path
 * the Residency Status dropdown provided on the edit form. Nothing posted to
 * it any more, but it stayed reachable by anyone who sent the field by hand.
 *
 * Promotion and reversion now happen only through the Make Permanent /
 * Revert to Temporary actions above, which are transactional, move and
 * archive the addresses, and write to resident_residency_changes.
 */

// Load an existing resident for edit mode
if (isset($_GET['edit'])) {
    $editing_resident_id = (int)$_GET['edit'];
    $edit_stmt = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? AND deleted_at IS NULL LIMIT 1");
    $edit_stmt->bind_param('i', $editing_resident_id);
    $edit_stmt->execute();
    $editing_resident = $edit_stmt->get_result()->fetch_assoc();
    $edit_stmt->close();
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_resident'])) {
    /*
     * A failed update posts back without ?edit= in the URL, so edit mode was
     * lost and the record went with it: the resident_id hidden field emptied,
     * and anything the form fell back to the stored record for came out blank.
     * Reading the id straight off the submission keeps the form pointed at the
     * right person while the error is corrected.
     */
    $editing_resident_id = (int)($_POST['resident_id'] ?? 0);
    if ($editing_resident_id > 0) {
        $edit_stmt = $conn->prepare("SELECT * FROM residents WHERE resident_id = ? AND deleted_at IS NULL LIMIT 1");
        $edit_stmt->bind_param('i', $editing_resident_id);
        $edit_stmt->execute();
        $editing_resident = $edit_stmt->get_result()->fetch_assoc();
        $edit_stmt->close();
    }
}

// Add a new resident
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_resident'])) {

    /* ------------------------------------------------------------------
       Family and household details.

       Spouse and parents are single names read straight off the form.
       Children and character references repeat, so they come back as a
       list with the blank rows already dropped.

       A spouse name is only kept when the answer to "is this resident
       married" was Yes, and children only when the answer was Yes — an
       answer of No clears anything typed before the radio was changed,
       so a stray name cannot survive on a record that says No.
       ------------------------------------------------------------------ */
    $occupation     = trim($_POST['occupation'] ?? '');
    $hotline_number = trim($_POST['hotline_number'] ?? '');
    $is_married     = ($_POST['is_married'] ?? '0') === '1' ? 1 : 0;
    $has_children   = ($_POST['has_children'] ?? '0') === '1' ? 1 : 0;

    $family_names = [];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $part) {
            $family_names[$who . '_' . $part] = trim($_POST[$who . '_' . $part] ?? '');
        }
        // "Others" hands over to the box beside it, the same way the
        // resident's own courtesy title does.
        $family_names[$who . '_courtesy_title'] = resolve_courtesy_title(
            $family_names[$who . '_courtesy_title'],
            trim($_POST[$who . '_courtesy_title_other'] ?? '')
        );
    }
    if (!$is_married) {
        foreach (person_field_keys() as $part) {
            $family_names['spouse_' . $part] = '';
        }
    }

    $child_rows     = $has_children ? collect_person_rows($_POST['children'] ?? []) : [];
    $reference_rows = collect_person_rows($_POST['references'] ?? []);

    $family_errors = array_merge(
        person_rows_errors($child_rows, 'Child'),
        person_rows_errors($reference_rows, 'Character reference')
    );

    // A married resident with no spouse name recorded is almost always a
    // half-finished form rather than a deliberate blank.
    if ($is_married && $family_names['spouse_last_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s surname, or answer No to "Is this resident married?".';
    }
    if ($is_married && $family_names['spouse_first_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s first name, or answer No to "Is this resident married?".';
    }
    if ($has_children && empty($child_rows)) {
        $family_errors[] = 'Add at least one child, or answer No to "Does this resident have children?".';
    }
    if (empty($reference_rows)) {
        $family_errors[] = 'At least one character reference is required.';
    }
    if ($hotline_number !== '' && !preg_match('/' . hotline_number_pattern() . '/', $hotline_number)) {
        $family_errors[] = 'Check the hotline number. ' . hotline_format_hint();
    }
    if (mb_strlen($occupation) > 100) {
        $family_errors[] = 'That occupation is too long (100 characters maximum).';
    }

    $current_year = date('Y');

    // Grab the absolute highest sequence number after the dash, regardless of the year
    $stmt = $conn->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(resident_number, '-', -1) AS UNSIGNED)) as max_seq FROM residents");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Increment from the highest existing number, or start at 1 if database is empty
    $next_seq = ($result && $result['max_seq']) ? (int)$result['max_seq'] + 1 : 1;

    // Format the number to maintain 4 digits (e.g., R-YYYY-0003)
    $resident_number = 'R-' . $current_year . '-' . str_pad($next_seq, 4, '0', STR_PAD_LEFT);

    $first_name = trim($_POST['first_name'] ?? '');
    $middle_name = trim($_POST['middle_name'] ?? '');
    $last_name = trim($_POST['last_name'] ?? '');
    $name_extension = trim($_POST['name_extension'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $contact_number = trim($_POST['contact_number'] ?? '');
    $birthdate = trim($_POST['birthdate'] ?? '');
    $birthplace = trim($_POST['birthplace'] ?? '');

    // Gender - whitelist the submitted value, never trust the dropdown
    $gender = $_POST['gender'] ?? '';
    if (!array_key_exists($gender, gender_options())) {
        $gender = '';
    }

    $courtesy_title = resolve_courtesy_title($_POST['courtesy_title'] ?? '', $_POST['courtesy_title_other'] ?? '');

    $special_category = $_POST['special_category'] ?? 'none';
    if (!in_array($special_category, ['none', 'pwd', 'senior_citizen', 'pregnant'], true)) {
        $special_category = 'none';
    }

    // The reference only belongs to a real category; choosing None clears any
    // number left behind by a previous selection.
    $category_reference = $special_category === 'none' ? '' : trim($_POST['category_reference'] ?? '');

    $residency_status = ($_POST['residency_status'] ?? 'permanent') === 'temporary' ? 'temporary' : 'permanent';

    // Date the person began residing here. Required for permanent status,
    // which the barangay only grants after a minimum length of stay.
    $residency_start_date = trim($_POST['residency_start_date'] ?? '');
    $residency_duration = residency_duration($residency_start_date);

    // Residence type only applies to a temporary resident. Clearing it for a
    // permanent one stops a stale "Boarding House" surviving a status change.
    $residence_type = $_POST['residence_type'] ?? '';
    if ($residency_status !== 'temporary' || !array_key_exists($residence_type, residence_types())) {
        $residence_type = '';
    }

    // Permanent address, seven parts.
    $addr = [];
    foreach (address_field_names() as $field) {
        $addr[$field] = trim($_POST[$field] ?? '');
    }
    $address = build_address_line(
        $addr['household_number'], $addr['purok'], $addr['street_highway'],
        $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province']
    );

    // Temporary address, same seven parts, only collected when temporary.
    $temp = [];
    foreach (address_field_names() as $field) {
        $temp[$field] = $residency_status === 'temporary' ? trim($_POST['temp_' . $field] ?? '') : '';
    }
    $temporary_address = build_address_line(
        $temp['household_number'], $temp['purok'], $temp['street_highway'],
        $temp['barangay'], $temp['municipality'], $temp['postal_code'], $temp['province']
    );

    // Collect every missing required field at once rather than revealing
    // them one submission at a time.
    $missing = [];
    foreach (required_address_fields() as $field) {
        if ($addr[$field] === '') {
            $missing[] = address_field_labels()[$field];
        }
    }
    if ($residency_status === 'temporary') {
        foreach (required_address_fields() as $field) {
            if ($temp[$field] === '') {
                $missing[] = 'Temporary ' . address_field_labels()[$field];
            }
        }
    }

    ensure_resident_birthdate_column($conn);

    if (
        $first_name === '' || $middle_name === '' || $last_name === ''
        || $birthdate === '' || $gender === '' || $birthplace === ''
    ) {
        $error = 'Please fill in all required fields (marked with *).';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($family_errors) {
        // Reported one at a time so the message stays readable; the rest
        // surface as each is dealt with.
        $error = $family_errors[0];
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($missing) {
        $error = 'Please fill in: ' . implode(', ', $missing) . '.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($residency_status === 'temporary' && $residence_type === '') {
        $error = 'Choose the type of temporary residence.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($addr['postal_code'] !== '' && !preg_match('/^\\d{4}$/', $addr['postal_code'])) {
        $error = 'A Philippine postal code is four digits.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif (!valid_contact_number($contact_number)) {
        $error = 'A contact number can only contain digits, spaces, +, -, and brackets.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($over = array_merge(
        overlong_address_fields($addr),
        $residency_status === 'temporary' ? overlong_address_fields($temp, 'Temporary ') : []
    )) {
        $error = 'These entries are too long: ' . implode(', ', $over) . '.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($special_category !== 'none' && $category_reference === '') {
        // A priority category without its supporting number cannot be verified
        // later, so the record is refused rather than saved half-complete.
        $fields = category_reference_fields();
        $error = 'Enter the ' . $fields[$special_category]['label']
               . ' for this resident, or set the category to None.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($special_category !== 'none' && mb_strlen($category_reference) > 60) {
        $error = 'That reference number is too long (60 characters maximum).';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($special_category !== 'none' && !valid_category_reference($special_category, $category_reference)) {
        // Same rule the browser applies, repeated here so a bypassed form
        // cannot store a malformed ID.
        $fields = category_reference_fields();
        $error = $fields[$special_category]['error'];
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($residency_start_date === '') {
        $error = 'Enter the date this person began residing in the barangay.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($residency_duration === null) {
        $error = 'The residency start date is not a valid past date.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($residency_status === 'permanent'
              && $residency_duration['total_months'] < permanent_residency_min_months()) {
        // The rule the barangay applies: a permanent record is only opened
        // after the minimum length of stay. Anyone shorter is registered as
        // temporary and converted later.
        $error = 'This person has been residing here for only '
            . format_residency_duration($residency_duration)
            . '. A resident must complete at least ' . permanent_residency_min_months()
            . ' months before they can be recorded as Permanent. Register them as Temporary for now,'
            . ' then change the status once they reach ' . permanent_residency_min_months() . ' months.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($birthdate !== '' && $residency_start_date < $birthdate) {
        $error = 'The residency start date cannot be earlier than the birthdate.';
        $form_had_error = true;
        $failed_form = 'add';
    } elseif ($birthdate > date('Y-m-d')) {
        // A future birthdate would produce a negative age
        $error = 'Birthdate cannot be in the future.';
        $form_had_error = true;
        $failed_form = 'add';
    } else {
        $stmt = $conn->prepare("SELECT 1 FROM residents WHERE resident_number = ?");
        $stmt->bind_param('s', $resident_number);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            $error = 'A resident with the generated Resident Number already exists. Please try again.';
            $form_had_error = true;
            $failed_form = 'add';
        }
        $stmt->close();

        if (!$error) {
            $default_hash = password_hash($resident_number, PASSWORD_DEFAULT);

            /* The resident and their children and references go in together:
               a resident saved without the character references that were
               required to create them would be a half-made record. */
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("
                    INSERT INTO residents (
                        resident_number, courtesy_title, first_name, middle_name, last_name, name_extension,
                        email, contact_number, birthdate, gender, birthplace,
                        address, household_number, purok, street_highway, barangay, municipality, postal_code, province,
                        residence_type, temporary_address,
                        temp_household_number, temp_purok, temp_street_highway, temp_barangay,
                        temp_municipality, temp_postal_code, temp_province,
                        special_category, category_reference, residency_status, residency_start_date,
                        occupation, hotline_number, is_married,
                        spouse_courtesy_title, spouse_first_name, spouse_middle_name, spouse_last_name,
                        spouse_name_extension, spouse_gender,
                        has_children,
                        father_courtesy_title, father_first_name, father_middle_name, father_last_name,
                        father_name_extension, father_gender,
                        mother_courtesy_title, mother_first_name, mother_middle_name, mother_last_name,
                        mother_name_extension, mother_gender,
                        password
                    )
                    VALUES (" . rtrim(str_repeat('?,', 55), ',') . ")
                ");
                /* 32 strings up to residency_start_date, occupation and hotline,
                   the married flag, six spouse fields, the children flag, six
                   father then six mother fields, and the password hash. */
                $stmt->bind_param(
                    str_repeat('s', 32) . 'ssi' . str_repeat('s', 6) . 'i' . str_repeat('s', 13),
                    $resident_number, $courtesy_title, $first_name, $middle_name, $last_name, $name_extension,
                    $email, $contact_number, $birthdate, $gender, $birthplace,
                    $address, $addr['household_number'], $addr['purok'], $addr['street_highway'],
                    $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province'],
                    $residence_type, $temporary_address,
                    $temp['household_number'], $temp['purok'], $temp['street_highway'], $temp['barangay'],
                    $temp['municipality'], $temp['postal_code'], $temp['province'],
                    $special_category, $category_reference, $residency_status, $residency_start_date,
                    $occupation, $hotline_number, $is_married,
                    $family_names['spouse_courtesy_title'], $family_names['spouse_first_name'],
                    $family_names['spouse_middle_name'], $family_names['spouse_last_name'],
                    $family_names['spouse_name_extension'], $family_names['spouse_gender'],
                    $has_children,
                    $family_names['father_courtesy_title'], $family_names['father_first_name'],
                    $family_names['father_middle_name'], $family_names['father_last_name'],
                    $family_names['father_name_extension'], $family_names['father_gender'],
                    $family_names['mother_courtesy_title'], $family_names['mother_first_name'],
                    $family_names['mother_middle_name'], $family_names['mother_last_name'],
                    $family_names['mother_name_extension'], $family_names['mother_gender'],
                    $default_hash
                );
                $stmt->execute();
                $new_resident_id = $conn->insert_id;
                $stmt->close();

                replace_person_rows($conn, 'resident_children', $new_resident_id, $child_rows);
                replace_person_rows($conn, 'resident_character_references', $new_resident_id, $reference_rows);

                $conn->commit();
            } catch (Exception $e) {
                $conn->rollback();
                error_log('Adding a resident failed: ' . $e->getMessage());
                $error = 'The resident could not be saved. Please try again.';
                $form_had_error = true;
                $failed_form = 'add';
            }

            if (!$error) {
                // 2. Set flash message and redirect to a clean URL (this fixes the reload bug!)
                $_SESSION['flash_success'] = "Resident added successfully. Their auto-generated Resident Number (and default password) is: <strong>" . h($resident_number) . "</strong>";
                redirect('resident_management.php');
            }
        }
    }
}

// Update an existing resident
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_resident'])) {
    // Same family details as the add form; see that handler for why an
    // answer of No clears the names behind it.
    $occupation     = trim($_POST['occupation'] ?? '');
    $hotline_number = trim($_POST['hotline_number'] ?? '');
    $is_married     = ($_POST['is_married'] ?? '0') === '1' ? 1 : 0;
    $has_children   = ($_POST['has_children'] ?? '0') === '1' ? 1 : 0;

    $family_names = [];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $part) {
            $family_names[$who . '_' . $part] = trim($_POST[$who . '_' . $part] ?? '');
        }
        // "Others" hands over to the box beside it, the same way the
        // resident's own courtesy title does.
        $family_names[$who . '_courtesy_title'] = resolve_courtesy_title(
            $family_names[$who . '_courtesy_title'],
            trim($_POST[$who . '_courtesy_title_other'] ?? '')
        );
    }
    if (!$is_married) {
        foreach (person_field_keys() as $part) {
            $family_names['spouse_' . $part] = '';
        }
    }

    $child_rows     = $has_children ? collect_person_rows($_POST['children'] ?? []) : [];
    $reference_rows = collect_person_rows($_POST['references'] ?? []);

    $family_errors = array_merge(
        person_rows_errors($child_rows, 'Child'),
        person_rows_errors($reference_rows, 'Character reference')
    );
    if ($is_married && $family_names['spouse_last_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s surname, or answer No to "Is this resident married?".';
    }
    if ($is_married && $family_names['spouse_first_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s first name, or answer No to "Is this resident married?".';
    }
    if ($has_children && empty($child_rows)) {
        $family_errors[] = 'Add at least one child, or answer No to "Does this resident have children?".';
    }
    if (empty($reference_rows)) {
        $family_errors[] = 'At least one character reference is required.';
    }
    if ($hotline_number !== '' && !preg_match('/' . hotline_number_pattern() . '/', $hotline_number)) {
        $family_errors[] = 'Check the hotline number. ' . hotline_format_hint();
    }
    if (mb_strlen($occupation) > 100) {
        $family_errors[] = 'That occupation is too long (100 characters maximum).';
    }

    $resident_id = (int)($_POST['resident_id'] ?? 0);
    $first_name = trim($_POST['first_name'] ?? '');
    $middle_name = trim($_POST['middle_name'] ?? '');
    $last_name = trim($_POST['last_name'] ?? '');
    $name_extension = trim($_POST['name_extension'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $contact_number = trim($_POST['contact_number'] ?? '');
    $birthdate = trim($_POST['birthdate'] ?? '');
    $birthplace = trim($_POST['birthplace'] ?? '');

    // Gender - whitelist the submitted value, never trust the dropdown
    $gender = $_POST['gender'] ?? '';
    if (!array_key_exists($gender, gender_options())) {
        $gender = '';
    }

    $courtesy_title = resolve_courtesy_title($_POST['courtesy_title'] ?? '', $_POST['courtesy_title_other'] ?? '');

    $special_category = $_POST['special_category'] ?? 'none';
    if (!in_array($special_category, ['none', 'pwd', 'senior_citizen', 'pregnant'], true)) {
        $special_category = 'none';
    }

    // The reference only belongs to a real category; choosing None clears any
    // number left behind by a previous selection.
    $category_reference = $special_category === 'none' ? '' : trim($_POST['category_reference'] ?? '');

    /*
     * Residency status is NOT taken from this form.
     *
     * The edit form used to carry a Permanent/Temporary dropdown, and saving
     * it wrote the new label straight to the column. That relabelled the
     * record without moving the addresses across, without archiving the old
     * one, and without writing anything to Residency Records — so a change
     * made that way left no trace and could not be undone.
     *
     * Moving between the two statuses is what the Make Permanent / Revert
     * button does, further up this file: transactional, address-aware, and
     * logged. Reading the stored value here keeps the edit form from being a
     * second, silent path to the same column.
     */
    $current_status = '';
    $current_start_date = '';
    $status_stmt = $conn->prepare("SELECT residency_status, residency_start_date FROM residents WHERE resident_id = ?");
    $status_stmt->bind_param('i', $resident_id);
    $status_stmt->execute();
    $status_row = $status_stmt->get_result()->fetch_assoc();
    $status_stmt->close();
    if ($status_row) {
        $current_status = $status_row['residency_status'] ?? '';
        $current_start_date = (string)($status_row['residency_start_date'] ?? '');
    }
    $residency_status = $current_status === 'temporary' ? 'temporary' : 'permanent';

    $residency_start_date = trim($_POST['residency_start_date'] ?? '');
    $residency_duration = residency_duration($residency_start_date);

    // Residence type only applies to a temporary resident. Clearing it for a
    // permanent one stops a stale "Boarding House" surviving a status change.
    $residence_type = $_POST['residence_type'] ?? '';
    if ($residency_status !== 'temporary' || !array_key_exists($residence_type, residence_types())) {
        $residence_type = '';
    }

    // Permanent address, seven parts.
    $addr = [];
    foreach (address_field_names() as $field) {
        $addr[$field] = trim($_POST[$field] ?? '');
    }
    $address = build_address_line(
        $addr['household_number'], $addr['purok'], $addr['street_highway'],
        $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province']
    );

    // Temporary address, same seven parts, only collected when temporary.
    $temp = [];
    foreach (address_field_names() as $field) {
        $temp[$field] = $residency_status === 'temporary' ? trim($_POST['temp_' . $field] ?? '') : '';
    }
    $temporary_address = build_address_line(
        $temp['household_number'], $temp['purok'], $temp['street_highway'],
        $temp['barangay'], $temp['municipality'], $temp['postal_code'], $temp['province']
    );

    // Collect every missing required field at once rather than revealing
    // them one submission at a time.
    $missing = [];
    foreach (required_address_fields() as $field) {
        if ($addr[$field] === '') {
            $missing[] = address_field_labels()[$field];
        }
    }
    if ($residency_status === 'temporary') {
        foreach (required_address_fields() as $field) {
            if ($temp[$field] === '') {
                $missing[] = 'Temporary ' . address_field_labels()[$field];
            }
        }
    }

    if (
        $resident_id <= 0 || $first_name === '' || $middle_name === '' || $last_name === ''
        || $birthdate === '' || $gender === '' || $birthplace === ''
    ) {
        $error = 'Please fill in all required fields (marked with *).';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($family_errors) {
        $error = $family_errors[0];
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($missing) {
        $error = 'Please fill in: ' . implode(', ', $missing) . '.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($residency_status === 'temporary' && $residence_type === '') {
        $error = 'Choose the type of temporary residence.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif (!valid_contact_number($contact_number)) {
        $error = 'A contact number can only contain digits, spaces, +, -, and brackets.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($over = array_merge(
        overlong_address_fields($addr),
        $residency_status === 'temporary' ? overlong_address_fields($temp, 'Temporary ') : []
    )) {
        $error = 'These entries are too long: ' . implode(', ', $over) . '.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($special_category !== 'none' && $category_reference === '') {
        // A priority category without its supporting number cannot be verified
        // later, so the record is refused rather than saved half-complete.
        $fields = category_reference_fields();
        $error = 'Enter the ' . $fields[$special_category]['label']
               . ' for this resident, or set the category to None.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($special_category !== 'none' && mb_strlen($category_reference) > 60) {
        $error = 'That reference number is too long (60 characters maximum).';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($special_category !== 'none' && !valid_category_reference($special_category, $category_reference)) {
        // Same rule the browser applies, repeated here so a bypassed form
        // cannot store a malformed ID.
        $fields = category_reference_fields();
        $error = $fields[$special_category]['error'];
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($residency_start_date === '') {
        $error = 'Enter the date this person began residing in the barangay.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($residency_duration === null) {
        $error = 'The residency start date is not a valid past date.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($residency_status === 'permanent'
              && $residency_start_date !== ($current_start_date ?? '')
              && $residency_duration['total_months'] < permanent_residency_min_months()) {
        /*
         * Only when the date is actually being changed.
         *
         * This rule used to guard the Residency Status dropdown. With the
         * dropdown gone, an unconditional check would trap the admin: a
         * permanent resident whose start date sits under the minimum — an
         * early promotion, or a date corrected afterwards — could never have
         * any other field edited, because there is no longer a way to set the
         * status to Temporary from this form to satisfy the rule.
         *
         * Comparing against the stored date keeps the rule where it belongs:
         * a new date that contradicts permanent status is refused, while an
         * existing record stays editable. Moving between the two statuses is
         * the Make Permanent / Revert button's job, and it checks separately.
         */
        $error = 'This person has been residing here for only '
            . format_residency_duration($residency_duration)
            . '. A resident must complete at least ' . permanent_residency_min_months()
            . ' months before they can be recorded as Permanent. Revert them to Temporary '
            . 'first if the date is correct.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($birthdate !== '' && $residency_start_date < $birthdate) {
        $error = 'The residency start date cannot be earlier than the birthdate.';
        $form_had_error = true;
        $failed_form = 'edit';
    } elseif ($birthdate > date('Y-m-d')) {
        $error = 'Birthdate cannot be in the future.';
        $form_had_error = true;
        $failed_form = 'edit';
    } else {
        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("UPDATE residents SET courtesy_title = ?, first_name = ?, middle_name = ?, last_name = ?,
                    name_extension = ?, email = ?, contact_number = ?, birthdate = ?, gender = ?, birthplace = ?,
                    address = ?, household_number = ?, purok = ?, street_highway = ?, barangay = ?, municipality = ?,
                    postal_code = ?, province = ?, residence_type = ?, temporary_address = ?,
                    temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                    temp_municipality = ?, temp_postal_code = ?, temp_province = ?,
                    special_category = ?, category_reference = ?, residency_status = ?, residency_start_date = ?,
                    occupation = ?, hotline_number = ?, is_married = ?,
                    spouse_courtesy_title = ?, spouse_first_name = ?, spouse_middle_name = ?,
                    spouse_last_name = ?, spouse_name_extension = ?, spouse_gender = ?,
                    has_children = ?,
                    father_courtesy_title = ?, father_first_name = ?, father_middle_name = ?,
                    father_last_name = ?, father_name_extension = ?, father_gender = ?,
                    mother_courtesy_title = ?, mother_first_name = ?, mother_middle_name = ?,
                    mother_last_name = ?, mother_name_extension = ?, mother_gender = ?
                  WHERE resident_id = ?");
            /* 31 strings, then occupation and hotline, the married flag as an
               integer, four spouse strings, the children flag, eight parent
               strings, and finally the integer resident_id. Miscounting this
               by one is what threw ArgumentCountError on save before. */
            /* 33 strings, the married flag, six spouse fields, the children
               flag, six father then six mother fields, then resident_id. */
            $stmt->bind_param(
                str_repeat('s', 33) . 'i' . str_repeat('s', 6) . 'i' . str_repeat('s', 12) . 'i',
                $courtesy_title, $first_name, $middle_name, $last_name, $name_extension, $email, $contact_number,
                $birthdate, $gender, $birthplace,
                $address, $addr['household_number'], $addr['purok'], $addr['street_highway'],
                $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province'],
                $residence_type, $temporary_address,
                $temp['household_number'], $temp['purok'], $temp['street_highway'], $temp['barangay'],
                $temp['municipality'], $temp['postal_code'], $temp['province'],
                $special_category, $category_reference, $residency_status, $residency_start_date,
                $occupation, $hotline_number, $is_married,
                $family_names['spouse_courtesy_title'], $family_names['spouse_first_name'],
                $family_names['spouse_middle_name'], $family_names['spouse_last_name'],
                $family_names['spouse_name_extension'], $family_names['spouse_gender'],
                $has_children,
                $family_names['father_courtesy_title'], $family_names['father_first_name'],
                $family_names['father_middle_name'], $family_names['father_last_name'],
                $family_names['father_name_extension'], $family_names['father_gender'],
                $family_names['mother_courtesy_title'], $family_names['mother_first_name'],
                $family_names['mother_middle_name'], $family_names['mother_last_name'],
                $family_names['mother_name_extension'], $family_names['mother_gender'],
                $resident_id
            );
            $stmt->execute();
            $stmt->close();

            replace_person_rows($conn, 'resident_children', $resident_id, $child_rows);
            replace_person_rows($conn, 'resident_character_references', $resident_id, $reference_rows);

            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            error_log('Updating a resident failed: ' . $e->getMessage());
            $error = 'The changes could not be saved. Please try again.';
            $form_had_error = true;
            $failed_form = 'edit';
        }

        if (!$error) {
            $_SESSION['flash_success'] = 'Resident updated successfully.';
            redirect('resident_management.php');
        }
    }
}

// Only an administrator sees a Delete button; everyone else sees Request Deletion.
$can_delete = staff_is_admin();

// Residents that already have a request in flight, so the button becomes a
// status instead of inviting a duplicate.
$pending_delete_ids = [];
$pending_result = $conn->query("SELECT resident_id FROM resident_delete_requests WHERE status = 'pending'");
if ($pending_result) {
    while ($pending_row = $pending_result->fetch_assoc()) {
        $pending_delete_ids[(int)$pending_row['resident_id']] = true;
    }
}

$residents = $conn->query("SELECT * FROM residents WHERE deleted_at IS NULL ORDER BY resident_number, last_name, first_name");
$resident_lookup = [];
$residents_for_lookup = $conn->query("SELECT * FROM residents WHERE deleted_at IS NULL ORDER BY resident_number, last_name, first_name");
if ($residents_for_lookup) {
    while ($resident_row = $residents_for_lookup->fetch_assoc()) {
        /*
         * Children and character references have to be carried in here too.
         *
         * The Edit modal is filled in by JavaScript from this lookup without
         * reloading the page, and the query above can only ever return columns
         * of `residents`. Children and references live in their own tables, so
         * they were never part of the data the modal was populated from: every
         * Edit opened with the reference rows blank, however many the resident
         * actually had on file. Saving then failed on "at least one character
         * reference is required" for a resident who already had one.
         */
        $resident_row['children']   = fetch_person_rows($conn, 'resident_children', (int)$resident_row['resident_id']);
        $resident_row['references'] = fetch_person_rows($conn, 'resident_character_references', (int)$resident_row['resident_id']);
        $resident_lookup[(int)$resident_row['resident_id']] = $resident_row;
    }
}

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Residents</h1>
        <p>View and manage the residents registered with the health center.</p>
    </div>
</div>

<div class="card">
    <div class="card-head">
        <h2 class="card-head-title">Registered Residents (<?= $residents->num_rows ?>)</h2>
        <!-- Both buttons share one size and sit side by side -->
        <div class="btn-pair">
            <button type="button" class="btn" data-modal-open="add-resident-modal">+ Add Resident</button>
            <!-- Accent instead of grey: grey read as "already selected" -->
            <button type="button" class="btn btn-accent" data-modal-open="edit-resident-chooser-modal">Edit Resident</button>
        </div>
    </div>
    <?php if ($error): ?><div class="alert alert-error alert-spaced"><?= h($error) ?></div><?php endif; ?>

    <!-- Search by name or resident number, plus quick filters so the table
         stays manageable as records pile up -->
    <div class="table-toolbar">
        <div class="search-field">
            <?= nav_icon('search') ?>
            <input type="search" id="resident-search" data-table-search="residents-table"
                   placeholder="Search Resident..." aria-label="Search residents by name or resident number">
        </div>
        <div class="filter-tabs">
            <button type="button" class="filter-tab active" data-filter-group="residents-table" data-filter="all">All</button>
            <button type="button" class="filter-tab" data-filter-group="residents-table" data-filter="permanent">Permanent</button>
            <button type="button" class="filter-tab" data-filter-group="residents-table" data-filter="temporary">Temporary</button>
            <button type="button" class="filter-tab" data-filter-group="residents-table" data-filter="pending-login">Pending Login</button>
            <button type="button" class="filter-tab" data-filter-group="residents-table" data-filter="deactivated">Deactivated</button>
        </div>
    </div>

    <table id="residents-table" class="table-spaced">
        <tr><th>Resident No.</th><th>Name</th><th>Gender</th><th>Age</th><th>Category</th><th>Contact</th><th>Address</th><th>Residency Status</th><th>Account</th><th>Actions</th></tr>
        <?php
        // "N/A" instead of a dash wherever the resident supplied no detail
        $category_labels = ['none' => 'N/A', 'pwd' => 'PWD', 'senior_citizen' => 'Senior Citizen', 'pregnant' => 'Pregnant'];
        $residents->data_seek(0); while ($r = $residents->fetch_assoc()):
            $full_name = trim($r['first_name'] . ' ' . $r['last_name']);
            $full_name = preg_replace('/\s+/', ' ', $full_name);
            $resident_age = get_resident_age_label($r['birthdate'] ?? null);
            $residency = $r['residency_status'] === 'temporary' ? 'temporary' : 'permanent';
            $account_active = (int)($r['is_active'] ?? 1) === 1;
            $row_filters = $residency
                . ($r['is_first_login'] ? ' pending-login' : '')
                . ($account_active ? '' : ' deactivated');
        ?>
        <tr class="resident-row"
            data-resident-id="<?= (int)$r['resident_id'] ?>"
            data-resident-number="<?= h($r['resident_number']) ?>"
            data-search-text="<?= h($r['resident_number'] . ' ' . $full_name) ?>"
            data-filter="<?= h($row_filters) ?>">
            <td><?= h($r['resident_number']) ?></td>
            <td><?= h($full_name) ?></td>
            <td><?= h(gender_label($r['gender'] ?? '')) ?></td>
            <td><?= h($resident_age) ?></td>
            <td>
                <?= $category_labels[$r['special_category'] ?? 'none'] ?? 'N/A' ?>
                <?php if (!empty($r['category_reference'])): ?>
                    <br><small class="muted-note mono"><?= h($r['category_reference']) ?></small>
                <?php endif; ?>
            </td>
            <td><?= $r['contact_number'] ? h($r['contact_number']) : 'N/A' ?></td>
            <td><?= $r['address'] ? h($r['address']) : 'N/A' ?></td>
            <td>
                <!-- View-only page: status is a badge. It is edited from the
                     Edit Resident form, which already has the dropdown. -->
                <span class="badge <?= $residency === 'permanent' ? 'badge-permanent' : 'badge-temporary' ?>">
                    <?= h(ucfirst($residency)) ?>
                </span>
            </td>
            <td>
                <?php if (!$account_active): ?>
                    <span class="badge badge-inactive">Deactivated</span>
                <?php elseif ($r['is_first_login']): ?>
                    <span class="badge badge-pending">First Login Pending</span>
                <?php else: ?>
                    <span class="badge badge-active">Active</span>
                <?php endif; ?>
            </td>
            <td>
                <div class="action-buttons">
                    <button type="button" class="btn-action btn-action-primary edit-resident-row"
                            title="Edit resident" aria-label="Edit resident"
                            data-resident-edit="<?= (int)$r['resident_id'] ?>"><?= nav_icon('edit') ?></button>
                    <a class="btn-action btn-action-warn" href="resident_management.php?reset=<?= (int)$r['resident_id'] ?>"
                       title="Reset password" aria-label="Reset password"
                       data-confirm="Reset this resident's password to their Resident Number?"><?= nav_icon('lock') ?></a>

                    <?php // Deactivation is the reversible action, so it comes first for everyone. ?>
                    <?php if ($account_active): ?>
                    <a class="btn-action btn-action-warn" href="resident_management.php?toggle=<?= (int)$r['resident_id'] ?>"
                       title="Deactivate account" aria-label="Deactivate account"
                       data-confirm="Deactivate <?= h($full_name) ?>? They will not be able to log in, but their survey history is kept."><?= nav_icon('power') ?></a>
                    <?php else: ?>
                    <a class="btn-action btn-action-success" href="resident_management.php?toggle=<?= (int)$r['resident_id'] ?>"
                       title="Reactivate account" aria-label="Reactivate account"
                       data-confirm="Reactivate <?= h($full_name) ?>?"><?= nav_icon('power') ?></a>
                    <?php endif; ?>

                    <?php if ($can_delete): ?>
                    <a class="btn-action btn-action-danger" href="resident_management.php?delete=<?= (int)$r['resident_id'] ?>"
                       title="Delete resident" aria-label="Delete resident"
                       data-confirm="Delete <?= h($full_name) ?>? Their submitted survey responses will also be deleted. This cannot be undone."><?= nav_icon('trash') ?></a>
                    <?php elseif (isset($pending_delete_ids[(int)$r['resident_id']])): ?>
                    <span class="btn-action btn-action-muted" title="Deletion request awaiting the administrator"><?= nav_icon('clock') ?></span>
                    <?php else: ?>
                    <button type="button" class="btn-action btn-action-danger"
                            title="Request deletion" aria-label="Request deletion"
                            data-request-delete
                            data-resident-id="<?= (int)$r['resident_id'] ?>"
                            data-resident-name="<?= h($full_name) ?>"
                            data-resident-number="<?= h($r['resident_number']) ?>"><?= nav_icon('trash') ?></button>
                    <?php endif; ?>
                </div>
            </td>
        </tr>
        <?php endwhile; ?>
        <tr class="no-match-row" style="display:none;"><td colspan="10">No residents match your search or filter.</td></tr>
    </table>
</div>

<!-- Add Resident modal (registration form) -->
<?php // Only reopened when the Add form is what failed. ?>
<div class="modal-overlay<?= ($form_had_error && $failed_form !== 'edit') ? ' active' : '' ?>" id="add-resident-modal">
    <div class="modal-box modal-wide">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Add Resident</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

        <p class="form-note"><span class="req">*</span> Required field. <strong>Note:</strong> Resident Number is auto-generated upon submission.</p>

        <form method="POST">
            <input type="hidden" name="add_resident" value="1">

            <div class="grid-2">
                <div>
                    <label for="courtesy_title">Courtesy Title</label>
                    <select id="courtesy_title" name="courtesy_title" data-title-select>
                        <option value="">None</option>
                        <?php foreach (courtesy_titles() as $title): ?>
                        <option value="<?= h($title) ?>" <?= (($_POST['courtesy_title'] ?? '') === $title) ? 'selected' : '' ?>><?= h($title) ?></option>
                        <?php endforeach; ?>
                        <option value="Others" <?= (($_POST['courtesy_title'] ?? '') === 'Others') ? 'selected' : '' ?>>Others</option>
                    </select>
                </div>
                <div data-title-other hidden>
                    <label for="courtesy_title_other">Specify Title</label>
                    <input type="text" id="courtesy_title_other" name="courtesy_title_other" maxlength="20"
                           placeholder="Dr., Engr., Atty." value="<?= h($_POST['courtesy_title_other'] ?? '') ?>">
                </div>
                <div>
                    <label for="first_name">First Name <span class="req">*</span></label>
                    <input type="text" id="first_name" name="first_name" required placeholder="e.g. Juan" value="<?= h($_POST['first_name'] ?? '') ?>">
                </div>
                <div>
                    <label for="middle_name">Middle Name <span class="req">*</span></label>
                    <input type="text" id="middle_name" name="middle_name" required placeholder="e.g. Santos" value="<?= h($_POST['middle_name'] ?? '') ?>">
                </div>
                <div>
                    <label for="last_name">Last Name <span class="req">*</span></label>
                    <input type="text" id="last_name" name="last_name" required placeholder="e.g. Dela Cruz" value="<?= h($_POST['last_name'] ?? '') ?>">
                </div>
                <div>
                    <label for="name_extension">Extension (e.g. Jr, II)</label>
                    <input type="text" id="name_extension" name="name_extension" placeholder="Optional" value="<?= h($_POST['name_extension'] ?? '') ?>">
                </div>
                <div>
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" placeholder="e.g. juandelacruz@gmail.com" value="<?= h($_POST['email'] ?? '') ?>">
                </div>
                <div>
                    <label for="contact_number">Contact Number</label>
                    <input type="tel" id="contact_number" name="contact_number" placeholder="e.g. 0917 123 4567"
                           pattern="<?= h(contact_number_pattern()) ?>" maxlength="20"
                           title="Digits, spaces, +, - and brackets only" value="<?= h($_POST['contact_number'] ?? '') ?>">
                </div>
                <div>
                    <label for="gender">Gender <span class="req">*</span></label>
                    <select id="gender" name="gender" required>
                        <option value="">Select gender</option>
                        <?php foreach (gender_options() as $gender_value => $gender_text): ?>
                        <option value="<?= h($gender_value) ?>" <?= (($_POST['gender'] ?? '') === $gender_value) ? 'selected' : '' ?>><?= h($gender_text) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div>
                    <label for="residency_status">Residency Status <span class="req">*</span></label>
                    <select id="residency_status" name="residency_status" required>
                        <option value="permanent" <?= (($_POST['residency_status'] ?? '') === 'permanent') ? 'selected' : '' ?>>Permanent</option>
                        <option value="temporary" <?= (($_POST['residency_status'] ?? '') === 'temporary') ? 'selected' : '' ?>>Temporary</option>
                    </select>
                </div>
                <div>
                    <label for="residency_start_date">Residing Here Since <span class="req">*</span></label>
                    <input type="date" id="residency_start_date" name="residency_start_date" required
                           max="<?= date('Y-m-d') ?>" data-residency-start
                           value="<?= h($_POST['residency_start_date'] ?? '') ?>">
                    <small class="field-hint" data-residency-note>
                        Permanent status requires at least <?= (int)permanent_residency_min_months() ?> months of residence.
                    </small>
                </div>
                <div>
                    <label for="birthdate">Birthdate <span class="req">*</span></label>
                    <input type="date" id="birthdate" name="birthdate" required max="<?= date('Y-m-d') ?>" value="<?= h($_POST['birthdate'] ?? '') ?>">
                </div>
                <div>
                    <label for="age_display">Age</label>
                    <input type="text" id="age_display" class="field-readonly" readonly tabindex="-1" placeholder="Select a birthdate">
                    <small class="field-hint">Calculated automatically from the birthdate.</small>
                </div>
                <div>
                    <label for="birthplace">Birthplace <span class="req">*</span></label>
                    <input type="text" id="birthplace" name="birthplace" required placeholder="e.g. San Ildefonso, Bulacan" value="<?= h($_POST['birthplace'] ?? '') ?>">
                </div>
                <div>
                    <label for="special_category">PWD / Senior Citizen / Pregnant <span class="req">*</span></label>
                    <select id="special_category" name="special_category" required>
                        <option value="none" <?= (($_POST['special_category'] ?? 'none') === 'none') ? 'selected' : '' ?>>None</option>
                        <option value="pwd" <?= (($_POST['special_category'] ?? '') === 'pwd') ? 'selected' : '' ?>>PWD</option>
                        <option value="senior_citizen" <?= (($_POST['special_category'] ?? '') === 'senior_citizen') ? 'selected' : '' ?>>Senior Citizen</option>
                        <option value="pregnant" <?= (($_POST['special_category'] ?? '') === 'pregnant') ? 'selected' : '' ?>>Pregnant</option>
                    </select>

                    <?php // Shown only for a real category; the label changes with it. ?>
                    <div class="category-reference" data-category-reference style="display:none;">
                        <label for="category_reference" data-reference-label>Reference Number <span class="req">*</span></label>
                        <input type="text" id="category_reference" name="category_reference" maxlength="60"
                               data-reference-input
                               value="<?= h($_POST['category_reference'] ?? '') ?>">
                        <small class="reference-format" data-reference-format></small>
                        <small class="field-hint" data-reference-hint></small>
                    </div>
                </div>
            </div>

            <h3 class="form-section-title">Permanent Address</h3>
            <div class="grid-2">
                <?php foreach (address_field_labels() as $field => $label):
                    $required = in_array($field, required_address_fields(), true);
                ?>
                <div>
                    <label for="<?= h($field) ?>"><?= h($label) ?><?= $required ? ' <span class="req">*</span>' : '' ?></label>
                    <input type="text" id="<?= h($field) ?>" name="<?= h($field) ?>" <?= $required ? 'required' : '' ?>
                           placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                           <?= $field === 'postal_code' ? 'inputmode="numeric" maxlength="4"' : '' ?>
                           value="<?= h($_POST[$field] ?? '') ?>">
                </div>
                <?php endforeach; ?>
            </div>

            <!-- Temporary residence. Hidden unless Residency Status is
                 Temporary; the inputs inside are disabled while hidden so the
                 browser cannot enforce `required` on a field nobody can see,
                 and so nothing is posted for a permanent resident. -->
            <div class="temp-residence-block" data-temp-block hidden>
                <h3 class="form-section-title">Temporary Residence</h3>

                <label for="residence_type">Type of Residence <span class="req">*</span></label>
                <select id="residence_type" name="residence_type">
                    <option value="">Select the type of residence</option>
                    <?php foreach (residence_types() as $code => $type_label): ?>
                    <option value="<?= h($code) ?>" <?= ($_POST['residence_type'] ?? '') === $code ? 'selected' : '' ?>><?= h($type_label) ?></option>
                    <?php endforeach; ?>
                </select>

                <h3 class="form-section-title">Temporary Address</h3>
                <div class="grid-2">
                    <?php foreach (address_field_labels() as $field => $label):
                        $required = in_array($field, required_address_fields(), true);
                    ?>
                    <div>
                        <label for="temp_<?= h($field) ?>"><?= h($label) ?><?= $required ? ' <span class="req">*</span>' : '' ?></label>
                        <input type="text" id="temp_<?= h($field) ?>" name="temp_<?= h($field) ?>"
                               placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                               <?= $field === 'postal_code' ? 'inputmode="numeric" maxlength="4"' : '' ?>
                               value="<?= h($_POST['temp_' . $field] ?? '') ?>">
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <?php
            // Spouse, children, parents, occupation, hotline and character
            // references. Shared with the edit form below so the two cannot
            // drift apart.
            $ff_prefix = 'add';
            $ff_values = $_SERVER['REQUEST_METHOD'] === 'POST' ? [
                'occupation'     => $_POST['occupation'] ?? '',
                'hotline_number' => $_POST['hotline_number'] ?? '',
                'is_married'     => $_POST['is_married'] ?? '0',
                'has_children'   => $_POST['has_children'] ?? '0',
                'children'       => collect_person_rows($_POST['children'] ?? []),
                'references'     => collect_person_rows($_POST['references'] ?? []),
            ] : [];
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                foreach (person_field_keys() as $ff_part) {
                    foreach (['spouse', 'father', 'mother'] as $ff_who) {
                        $ff_values[$ff_who . '_' . $ff_part] = $_POST[$ff_who . '_' . $ff_part] ?? '';
                    }
                }
            }
            require __DIR__ . '/../includes/family_fields.php';
            ?>

            <button type="submit">Add Resident</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
        </form>
    </div>
</div>

<!-- Edit Resident chooser modal -->
<div class="modal-overlay" id="edit-resident-chooser-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Edit Resident</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

        <p class="form-note"><span class="req">*</span> Required field. <strong>Note:</strong> Choose a resident ID first, then the edit form will open in a separate popup.</p>

        <div class="form-section">
            <label for="edit-resident-select">Resident ID</label>
            <select id="edit-resident-select" name="edit_resident_select">
                <option value="">Select resident ID</option>
                <?php $residents->data_seek(0); while ($resident_option = $residents->fetch_assoc()): ?>
                    <option value="<?= (int)$resident_option['resident_id'] ?>" <?= ($editing_resident_id === (int)$resident_option['resident_id']) ? 'selected' : '' ?>><?= h($resident_option['resident_number']) ?> - <?= h($resident_option['first_name'] . ' ' . $resident_option['last_name']) ?></option>
                <?php endwhile; ?>
            </select>
            <button type="button" class="btn btn-secondary" id="load-edit-resident-btn">Show Edit Form</button>
        </div>
    </div>
</div>

<!-- Edit Resident info modal -->
<?php /* Reopened with the submitted values still in place when an update
          fails, so the person can fix the one field that was wrong instead of
          being dropped back to a blank Add Resident form. */ ?>
<div class="modal-overlay<?= ($form_had_error && $failed_form === 'edit') ? ' active' : '' ?>" id="edit-resident-info-modal">
    <div class="modal-box modal-wide">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Edit Resident Info</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

        <form method="POST">
            <input type="hidden" name="update_resident" value="1">
            <input type="hidden" name="resident_id" value="<?= (int)($_POST['resident_id'] ?? ($editing_resident['resident_id'] ?? $editing_resident_id)) ?>">

            <div class="grid-2">
                <div>
                    <label for="edit_courtesy_title">Courtesy Title</label>
                    <select id="edit_courtesy_title" name="courtesy_title" data-title-select>
                        <option value="">None</option>
                        <?php foreach (courtesy_titles() as $title): ?>
                        <option value="<?= h($title) ?>" <?= (($_POST['courtesy_title'] ?? ($editing_resident['courtesy_title'] ?? '')) === $title) ? 'selected' : '' ?>><?= h($title) ?></option>
                        <?php endforeach; ?>
                        <option value="Others" <?= (($_POST['courtesy_title'] ?? '') === 'Others') ? 'selected' : '' ?>>Others</option>
                    </select>
                </div>
                <div data-title-other hidden>
                    <label for="edit_courtesy_title_other">Specify Title</label>
                    <input type="text" id="edit_courtesy_title_other" name="courtesy_title_other" maxlength="20"
                           placeholder="Dr., Engr., Atty." value="<?= h($_POST['courtesy_title_other'] ?? '') ?>">
                </div>
                <div>
                    <label for="edit_first_name">First Name <span class="req">*</span></label>
                    <input type="text" id="edit_first_name" name="first_name" required placeholder="e.g. Juan" value="<?= h($_POST['first_name'] ?? ($editing_resident['first_name'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_middle_name">Middle Name <span class="req">*</span></label>
                    <input type="text" id="edit_middle_name" name="middle_name" required placeholder="e.g. Santos" value="<?= h($_POST['middle_name'] ?? ($editing_resident['middle_name'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_last_name">Last Name <span class="req">*</span></label>
                    <input type="text" id="edit_last_name" name="last_name" required placeholder="e.g. Dela Cruz" value="<?= h($_POST['last_name'] ?? ($editing_resident['last_name'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_name_extension">Extension (e.g. Jr, II)</label>
                    <input type="text" id="edit_name_extension" name="name_extension" placeholder="Optional" value="<?= h($_POST['name_extension'] ?? ($editing_resident['name_extension'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_email">Email</label>
                    <input type="email" id="edit_email" name="email" placeholder="e.g. juandelacruz@gmail.com" value="<?= h($_POST['email'] ?? ($editing_resident['email'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_contact_number">Contact Number</label>
                    <input type="tel" id="edit_contact_number" name="contact_number" placeholder="e.g. 0917 123 4567"
                           pattern="<?= h(contact_number_pattern()) ?>" maxlength="20"
                           title="Digits, spaces, +, - and brackets only" value="<?= h($_POST['contact_number'] ?? ($editing_resident['contact_number'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_gender">Gender <span class="req">*</span></label>
                    <select id="edit_gender" name="gender" required>
                        <option value="">Select gender</option>
                        <?php foreach (gender_options() as $gender_value => $gender_text): ?>
                        <option value="<?= h($gender_value) ?>" <?= (($_POST['gender'] ?? ($editing_resident['gender'] ?? '')) === $gender_value) ? 'selected' : '' ?>><?= h($gender_text) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div>
                    <label>Residency Status</label>
                    <?php
                    /*
                     * Shown, not editable.
                     *
                     * A dropdown here wrote the column directly, which
                     * relabelled the resident without moving their addresses
                     * or recording anything in Residency Records. The button
                     * below is the only way to move between the two, and it
                     * does the archiving and logging that the change needs.
                     */
                    ?>
                    <p class="field-static" id="edit-residency-display">
                        <span class="badge" id="edit-residency-badge">Permanent</span>
                    </p>

                    <?php if ($can_delete): ?>
                    <div class="residency-switch" id="residency-switch" style="display:none;">
                        <p class="residency-switch-note" id="residency-switch-note"></p>
                        <button type="button" class="btn btn-secondary btn-small" id="residency-switch-btn"></button>
                    </div>
                    <?php else: ?>
                    <small class="field-hint">
                        Only an administrator can move a resident between temporary and permanent.
                    </small>
                    <?php endif; ?>
                </div>
                <div>
                    <label for="edit_residency_start_date">Residing Here Since <span class="req">*</span></label>
                    <input type="date" id="edit_residency_start_date" name="residency_start_date" required
                           max="<?= date('Y-m-d') ?>" data-residency-start
                           value="<?= h($_POST['residency_start_date'] ?? ($editing_resident['residency_start_date'] ?? '')) ?>">
                    <small class="field-hint" data-residency-note>
                        Permanent status requires at least <?= (int)permanent_residency_min_months() ?> months of residence.
                    </small>
                </div>
                <div>
                    <label for="edit_birthdate">Birthdate <span class="req">*</span></label>
                    <input type="date" id="edit_birthdate" name="birthdate" required max="<?= date('Y-m-d') ?>" value="<?= h($_POST['birthdate'] ?? ($editing_resident['birthdate'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_age_display">Age</label>
                    <input type="text" id="edit_age_display" class="field-readonly" readonly tabindex="-1" placeholder="Select a birthdate">
                    <small class="field-hint">Calculated automatically from the birthdate.</small>
                </div>
                <div>
                    <label for="edit_birthplace">Birthplace <span class="req">*</span></label>
                    <input type="text" id="edit_birthplace" name="birthplace" required placeholder="e.g. San Ildefonso, Bulacan" value="<?= h($_POST['birthplace'] ?? ($editing_resident['birthplace'] ?? '')) ?>">
                </div>
                <div>
                    <label for="edit_special_category">PWD / Senior Citizen / Pregnant <span class="req">*</span></label>
                    <select id="edit_special_category" name="special_category" required>
                        <option value="none" <?= (($_POST['special_category'] ?? ($editing_resident['special_category'] ?? 'none')) === 'none') ? 'selected' : '' ?>>None</option>
                        <option value="pwd" <?= (($_POST['special_category'] ?? ($editing_resident['special_category'] ?? 'none')) === 'pwd') ? 'selected' : '' ?>>PWD</option>
                        <option value="senior_citizen" <?= (($_POST['special_category'] ?? ($editing_resident['special_category'] ?? 'none')) === 'senior_citizen') ? 'selected' : '' ?>>Senior Citizen</option>
                        <option value="pregnant" <?= (($_POST['special_category'] ?? ($editing_resident['special_category'] ?? 'none')) === 'pregnant') ? 'selected' : '' ?>>Pregnant</option>
                    </select>

                    <div class="category-reference" data-category-reference style="display:none;">
                        <label for="edit_category_reference" data-reference-label>Reference Number <span class="req">*</span></label>
                        <input type="text" id="edit_category_reference" name="category_reference" maxlength="60"
                               data-reference-input
                               value="<?= h($_POST['category_reference'] ?? ($editing_resident['category_reference'] ?? '')) ?>">
                        <small class="reference-format" data-reference-format></small>
                        <small class="field-hint" data-reference-hint></small>
                    </div>
                </div>
            </div>

            <h3 class="form-section-title">Permanent Address</h3>
            <div class="grid-2">
                <?php foreach (address_field_labels() as $field => $label):
                    $required = in_array($field, required_address_fields(), true);
                ?>
                <div>
                    <label for="edit_<?= h($field) ?>"><?= h($label) ?><?= $required ? ' <span class="req">*</span>' : '' ?></label>
                    <input type="text" id="edit_<?= h($field) ?>" name="<?= h($field) ?>" <?= $required ? 'required' : '' ?>
                           placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                           <?= $field === 'postal_code' ? 'inputmode="numeric" maxlength="4"' : '' ?>
                           value="<?= h($_POST[$field] ?? ($editing_resident[$field] ?? '')) ?>">
                </div>
                <?php endforeach; ?>
            </div>

            <!-- Temporary residence. Hidden unless Residency Status is
                 Temporary; the inputs inside are disabled while hidden so the
                 browser cannot enforce `required` on a field nobody can see,
                 and so nothing is posted for a permanent resident. -->
            <div class="temp-residence-block" data-temp-block hidden>
                <h3 class="form-section-title">Temporary Residence</h3>

                <label for="edit_residence_type">Type of Residence <span class="req">*</span></label>
                <select id="edit_residence_type" name="residence_type">
                    <option value="">Select the type of residence</option>
                    <?php foreach (residence_types() as $code => $type_label): ?>
                    <option value="<?= h($code) ?>" <?= ($_POST['residence_type'] ?? ($editing_resident['residence_type'] ?? '')) === $code ? 'selected' : '' ?>><?= h($type_label) ?></option>
                    <?php endforeach; ?>
                </select>

                <h3 class="form-section-title">Temporary Address</h3>
                <div class="grid-2">
                    <?php foreach (address_field_labels() as $field => $label):
                        $required = in_array($field, required_address_fields(), true);
                    ?>
                    <div>
                        <label for="edit_temp_<?= h($field) ?>"><?= h($label) ?><?= $required ? ' <span class="req">*</span>' : '' ?></label>
                        <input type="text" id="edit_temp_<?= h($field) ?>" name="temp_<?= h($field) ?>"
                               placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                               <?= $field === 'postal_code' ? 'inputmode="numeric" maxlength="4"' : '' ?>
                               value="<?= h($_POST['temp_' . $field] ?? ($editing_resident['temp_' . $field] ?? '')) ?>">
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <?php
            // Same fields as the add form. Values come from the resident being
            // edited unless a rejected submission is being shown back.
            $ff_prefix = 'edit';
            $ff_posted = $_SERVER['REQUEST_METHOD'] === 'POST';
            $ff_source = $editing_resident ?? [];
            $ff_values = [
                'occupation'     => $ff_posted ? ($_POST['occupation'] ?? '')     : ($ff_source['occupation'] ?? ''),
                'hotline_number' => $ff_posted ? ($_POST['hotline_number'] ?? '') : ($ff_source['hotline_number'] ?? ''),
                'is_married'     => $ff_posted ? ($_POST['is_married'] ?? '0')    : (string)(int)($ff_source['is_married'] ?? 0),
                'has_children'   => $ff_posted ? ($_POST['has_children'] ?? '0')  : (string)(int)($ff_source['has_children'] ?? 0),
            ];
            foreach (person_field_keys() as $ff_part) {
                foreach (['spouse', 'father', 'mother'] as $ff_who) {
                    $ff_key = $ff_who . '_' . $ff_part;
                    $ff_values[$ff_key] = $ff_posted ? ($_POST[$ff_key] ?? '') : ($ff_source[$ff_key] ?? '');
                }
            }
            if ($ff_posted) {
                $ff_values['children']   = collect_person_rows($_POST['children'] ?? []);
                $ff_values['references'] = collect_person_rows($_POST['references'] ?? []);
            } elseif (!empty($editing_resident_id)) {
                $ff_values['children']   = fetch_person_rows($conn, 'resident_children', (int)$editing_resident_id);
                $ff_values['references'] = fetch_person_rows($conn, 'resident_character_references', (int)$editing_resident_id);
            }
            require __DIR__ . '/../includes/family_fields.php';
            ?>

            <button type="submit">Update Resident</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
        </form>
    </div>
</div>

<!-- Success confirmation modal -->
<div class="modal-overlay<?= ($message && !$form_had_error) ? ' active' : '' ?>" id="resident-success-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Success</h2>
        <p class="modal-text"><?= $message ?></p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>

<script>
(function () {
    var residentLookup = <?php echo json_encode($resident_lookup, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT); ?>;
    var selectResident = document.getElementById('edit-resident-select');
    var loadEditResidentBtn = document.getElementById('load-edit-resident-btn');
    var chooserModal = document.getElementById('edit-resident-chooser-modal');
    var infoModal = document.getElementById('edit-resident-info-modal');

    // Must match address_field_names() in config/functions.php.
    var ADDRESS_FIELDS = ['household_number', 'purok', 'street_highway', 'barangay', 'municipality', 'postal_code', 'province'];

    function setValueIfPresent(id, value) {
        var field = document.getElementById(id);
        if (field) {
            field.value = value || '';
        }
    }

    function showEditFormForResident(residentId) {
        var resident = residentLookup[residentId];
        if (!resident) {
            alert('The selected resident could not be loaded.');
            return;
        }

        document.querySelector('#edit-resident-info-modal input[name="resident_id"]').value = resident.resident_id;
        setValueIfPresent('edit_first_name', resident.first_name);
        setValueIfPresent('edit_middle_name', resident.middle_name);
        setValueIfPresent('edit_last_name', resident.last_name);
        setValueIfPresent('edit_name_extension', resident.name_extension);
        setValueIfPresent('edit_email', resident.email);
        setValueIfPresent('edit_contact_number', resident.contact_number);
        setValueIfPresent('edit_birthdate', resident.birthdate);
        setValueIfPresent('edit_birthplace', resident.birthplace);
        // Address comes straight from the stored columns. The old code split
        // resident.address on commas and filled by position, which put the
        // wrong text in every box whenever the comma count differed.
        ADDRESS_FIELDS.forEach(function (field) {
            setValueIfPresent('edit_' + field, resident[field]);
            setValueIfPresent('edit_temp_' + field, resident['temp_' + field]);
        });
        setValueIfPresent('edit_residence_type', resident.residence_type);

        var titleField = document.getElementById('edit_courtesy_title');
        var titleOtherInput = document.getElementById('edit_courtesy_title_other');
        if (titleField) {
            var stored = resident.courtesy_title || '';
            var known = Array.prototype.some.call(titleField.options, function (o) {
                return o.value === stored && o.value !== 'Others';
            });
            // A title we do not offer as an option came from "Others", so
            // restore it into the free-text box rather than losing it.
            titleField.value = stored === '' ? '' : (known ? stored : 'Others');
            if (titleOtherInput) { titleOtherInput.value = known ? '' : stored; }
            titleField.dispatchEvent(new Event('change'));
        }

        var genderField = document.getElementById('edit_gender');
        if (genderField) {
            genderField.value = resident.gender || '';
        }
        var specialCategoryField = document.getElementById('edit_special_category');
        if (specialCategoryField) {
            specialCategoryField.value = resident.special_category || 'none';
        }
        var categorySelect = document.getElementById('edit_special_category');
        var categoryRef = document.getElementById('edit_category_reference');
        if (categorySelect) {
            categorySelect.value = resident.special_category || 'none';
            if (categoryRef) { categoryRef.value = resident.category_reference || ''; }
            categorySelect.dispatchEvent(new Event('change'));
        }

        var residencyStartField = document.getElementById('edit_residency_start_date');
        if (residencyStartField) {
            residencyStartField.value = resident.residency_start_date || '';
            residencyStartField.dispatchEvent(new Event('change'));
        }

        /*
         * Residency status is read-only in this form, so there is no field to
         * set — the badge is filled in from the saved record, and the
         * temporary address block is shown or hidden to match it.
         *
         * The shared toggle further down keys off [name="residency_status"],
         * which the edit form no longer has, so the same show/hide and
         * enable/disable work is done here against the saved value. Disabling
         * matters as much as hiding: a hidden `required` field blocks
         * submission with a message nobody can see.
         */
        var savedStatus = resident.residency_status === 'temporary' ? 'temporary' : 'permanent';
        var isTemporary = savedStatus === 'temporary';

        var residencyBadge = document.getElementById('edit-residency-badge');
        if (residencyBadge) {
            residencyBadge.textContent = isTemporary ? 'Temporary' : 'Permanent';
            residencyBadge.classList.toggle('badge-temporary', isTemporary);
            residencyBadge.classList.toggle('badge-permanent', !isTemporary);
        }

        var editModal = document.getElementById('edit-resident-info-modal');
        var editTempBlock = editModal ? editModal.querySelector('[data-temp-block]') : null;
        if (editTempBlock) {
            editTempBlock.hidden = !isTemporary;
            editTempBlock.querySelectorAll('input, select').forEach(function (field) {
                field.disabled = !isTemporary;
                var label = field.previousElementSibling;
                var isRequired = label && label.querySelector && label.querySelector('.req');
                field.required = isTemporary && !!isRequired;
            });
        }

        // The residency switch reads the status the resident is SAVED with,
        // not whatever the dropdown currently shows, because it acts on the
        // stored record.
        var switchBox = document.getElementById('residency-switch');
        if (switchBox) {
            var switchBtn = document.getElementById('residency-switch-btn');
            var switchNote = document.getElementById('residency-switch-note');
            var saved = resident.residency_status || 'permanent';
            var hasTemp = !!(resident.temp_household_number || resident.temporary_address);

            switchBox.style.display = 'block';
            switchBtn.dataset.residentId = resident.resident_id;
            switchBtn.dataset.residentName =
                ((resident.first_name || '') + ' ' + (resident.last_name || '')).trim();
            switchBtn.dataset.currentAddress = resident.address || '';
            switchBtn.dataset.tempAddress = resident.temporary_address || '';

            if (saved === 'permanent') {
                switchBtn.textContent = 'Revert to Temporary Resident';
                switchBtn.dataset.action = 'revert';
                switchBtn.disabled = false;
                switchNote.textContent = 'Currently Permanent. Reverting restores the address archived when they were made permanent.';
            } else {
                switchBtn.textContent = 'Make Permanent Resident';
                switchBtn.dataset.action = 'promote';
                switchBtn.disabled = !hasTemp;
                switchNote.textContent = hasTemp
                    ? 'Currently Temporary. Their temporary address becomes their permanent one, and the current address is archived.'
                    : 'Currently Temporary. Add a temporary address first - there is nothing to promote.';
            }
        }

        /* ---------- Family and household details ----------
           These were not filled in at all, so every Edit opened with the
           whole section blank: occupation and hotline empty, the marital
           answer stuck on No, and no child or reference rows however many
           the resident had on file. Saving then failed on the required
           character reference for a resident who already had one. */
        setValueIfPresent('edit_occupation', resident.occupation);
        setValueIfPresent('edit_hotline_number', resident.hotline_number);

        /* Put a stored title back on a select that may not offer it.
           Anything typed through "Others" — Engr., Atty., Dr. — is not one of
           the four listed options, so assigning it directly would leave the
           select blank and quietly lose the title on the next save. */
        function applyTitle(select, otherBox, stored) {
            if (!select) { return; }
            stored = stored || '';
            var known = Array.prototype.some.call(select.options, function (o) {
                return o.value === stored && o.value !== 'Others';
            });
            select.value = stored === '' ? '' : (known ? stored : 'Others');
            if (otherBox) {
                otherBox.value = known || stored === '' ? '' : stored;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        ['spouse', 'father', 'mother'].forEach(function (who) {
            ['last_name', 'first_name', 'middle_name', 'name_extension', 'gender'].forEach(function (part) {
                setValueIfPresent('edit_' + who + '_' + part, resident[who + '_' + part]);
            });
            applyTitle(
                document.getElementById('edit_' + who + '_courtesy_title'),
                document.getElementById('edit_' + who + '_courtesy_title_other'),
                resident[who + '_courtesy_title']
            );
        });

        // Tick the saved answer, then let the change handler show or hide the
        // block behind it. Setting .checked alone leaves the block out of step.
        function setChoice(name, on) {
            var wanted = String(on) === '1' ? '1' : '0';
            var radios = infoModal
                ? infoModal.querySelectorAll('input[type="radio"][name="' + name + '"]')
                : [];
            radios.forEach(function (radio) {
                radio.checked = radio.value === wanted;
            });
            if (radios.length) {
                radios[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        setChoice('is_married', Number(resident.is_married) === 1 ? '1' : '0');
        setChoice('has_children', Number(resident.has_children) === 1 ? '1' : '0');

        /* Rebuild a repeatable set of names from the stored rows. The first
           row is kept as the template and cloned, so the markup only has to be
           right in the PHP that rendered it. An empty set still leaves one
           blank row to type into. */
        function fillPersonRows(field, rows) {
            var group = infoModal
                ? infoModal.querySelector('[data-person-rows="' + field + '"]')
                : null;
            if (!group) { return; }

            var template = group.querySelector('[data-person-row]');
            if (!template) { return; }

            var blank = template.cloneNode(true);
            // Selects as well as inputs: courtesy title and gender are
            // dropdowns, and clearing only the text boxes would leave a
            // previous person's title stuck on a fresh row.
            blank.querySelectorAll('input, select').forEach(function (control) {
                control.value = '';
            });

            group.innerHTML = '';
            var list = (rows && rows.length) ? rows : [null];

            list.forEach(function (row, index) {
                var copy = blank.cloneNode(true);
                copy.querySelectorAll('input[name], select[name]').forEach(function (control) {
                    control.name = control.name.replace(/^\w+\[\d+\]/, field + '[' + index + ']');
                    var part = control.name.replace(/^.*\[(\w+)\]$/, '$1');
                    control.disabled = false;

                    // The "Others" box is filled by applyTitle below, not from
                    // a stored field of its own — there is no such column.
                    if (part === 'courtesy_title_other') { return; }

                    control.value = row && row[part] ? row[part] : '';
                });

                /* Append before restoring the title. applyTitle fires a change
                   event, and the handler that shows or hides the "Others" box
                   is delegated from the document — a row still detached from
                   the page never reaches it, which left the box holding a
                   value while staying hidden. */
                group.appendChild(copy);

                var rowTitle = copy.querySelector('[data-title-select]');
                if (rowTitle) {
                    applyTitle(rowTitle, copy.querySelector('[data-title-other]'), row ? row.courtesy_title : '');
                }
            });

            if (window.renumberPersonRows) {
                window.renumberPersonRows(group);
            }
        }

        fillPersonRows('children', resident.children);
        fillPersonRows('references', resident.references);

        if (chooserModal) {
            chooserModal.classList.remove('active');
        }
        if (infoModal) {
            infoModal.classList.add('active');
        }

        if (window.updateEditAgeDisplay) {
            window.updateEditAgeDisplay();
        }
    }

    if (selectResident && loadEditResidentBtn) {
        loadEditResidentBtn.addEventListener('click', function () {
            if (!selectResident.value) {
                alert('Please choose a resident ID first.');
                return;
            }

            showEditFormForResident(parseInt(selectResident.value, 10));
        });
    }

    // Edit directly from the resident's table row.
    document.querySelectorAll('.edit-resident-row').forEach(function (button) {
        button.addEventListener('click', function () {
            showEditFormForResident(parseInt(button.getAttribute('data-resident-edit'), 10));
        });
    });
})();
</script>

<script>
// Auto-fill the read-only Age field from the selected birthdate.
// Age is display-only and never submitted — it is always derived
// from birthdate so it cannot go stale in the database.
(function () {
    function computeAge(value) {
        if (!value) { return ''; }
        var parts = value.split('-');
        if (parts.length !== 3) { return ''; }

        var born = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(born.getTime())) { return ''; }

        var today = new Date();
        if (born > today) { return 'Invalid birthdate'; }

        var age = today.getFullYear() - born.getFullYear();
        var monthDiff = today.getMonth() - born.getMonth();

        // Subtract a year if this year's birthday has not happened yet
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
            age = age - 1;
        }

        if (age < 0) { return 'Invalid birthdate'; }
        return age === 1 ? '1 year old' : age + ' years old';
    }

    function updateAddAgeDisplay() {
        var birthdateInput = document.getElementById('birthdate');
        var ageField = document.getElementById('age_display');
        if (!birthdateInput || !ageField) { return; }
        ageField.value = computeAge(birthdateInput.value);
    }

    function updateEditAgeDisplay() {
        var birthdateInput = document.getElementById('edit_birthdate');
        var ageField = document.getElementById('edit_age_display');
        if (!birthdateInput || !ageField) { return; }
        ageField.value = computeAge(birthdateInput.value);
    }

    window.updateEditAgeDisplay = updateEditAgeDisplay;

    var addBirthdateInput = document.getElementById('birthdate');
    if (addBirthdateInput) {
        addBirthdateInput.addEventListener('change', updateAddAgeDisplay);
        addBirthdateInput.addEventListener('input', updateAddAgeDisplay);
        updateAddAgeDisplay();
    }

    var editBirthdateInput = document.getElementById('edit_birthdate');
    if (editBirthdateInput) {
        editBirthdateInput.addEventListener('change', updateEditAgeDisplay);
        editBirthdateInput.addEventListener('input', updateEditAgeDisplay);
        updateEditAgeDisplay();
    }
})();
</script>

<?php if (!$can_delete): ?>
<!-- Request Deletion modal (staff route to removing a record) -->
<div class="modal-overlay" id="request-delete-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2>Request Deletion</h2>

        <p class="modal-text" id="request-delete-target"></p>

        <div class="alert alert-info">
            Nothing is removed yet. An administrator reviews the request and decides.
            If you only need to block this resident from logging in, deactivate the
            account instead &mdash; that keeps their survey responses.
        </div>

        <form method="POST">
            <input type="hidden" name="request_delete" value="1">
            <input type="hidden" name="resident_id" id="request-delete-id" value="">

            <label for="reason">Reason <span class="req">*</span></label>
            <input type="text" id="reason" name="reason" required maxlength="255"
                   placeholder="Duplicate record, moved out of the barangay, deceased">
            <small class="field-hint">The administrator sees this, so be specific.</small>

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit">Send Request</button>
            </div>
        </form>
    </div>
</div>

<script>
(function () {
    var modal = document.getElementById('request-delete-modal');
    if (!modal) { return; }

    var target = document.getElementById('request-delete-target');
    var idField = document.getElementById('request-delete-id');
    var reason = document.getElementById('reason');

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-request-delete]');
        if (!trigger) { return; }

        idField.value = trigger.getAttribute('data-resident-id');
        target.textContent = 'Ask the administrator to delete ' +
            trigger.getAttribute('data-resident-name') +
            ' (' + trigger.getAttribute('data-resident-number') + ').';
        reason.value = '';
        modal.classList.add('active');
    });
})();
</script>
<?php endif; ?>

<script>
/**
 * Courtesy title "Others", and the temporary-residence block.
 *
 * Both add and edit modals use the same data- attributes, so this runs per
 * modal rather than per element ID.
 */
(function () {
    // "Others" hands the title to a free-text box.
    document.querySelectorAll('[data-title-select]').forEach(function (select) {
        var scope = select.closest('.modal-box') || document;
        var other = scope.querySelector('[data-title-other]');
        if (!other) { return; }

        function sync() {
            var custom = select.value === 'Others';
            other.hidden = !custom;
            var input = other.querySelector('input');
            if (input) {
                input.required = custom;
                if (!custom) { input.value = ''; }
            }
        }
        select.addEventListener('change', sync);
        sync();
    });

    // ---------- Residency length ----------
    // Shows the years/months/days total as soon as a date is picked, and warns
    // when Permanent is chosen too early. The server re-checks this; the
    // message here just saves the staff member a round trip.
    var MIN_MONTHS = <?= (int)permanent_residency_min_months() ?>;

    document.querySelectorAll('[data-residency-start]').forEach(function (dateField) {
        var scope = dateField.closest('.modal-box') || document;
        var status = scope.querySelector('[name="residency_status"]');
        var badge = scope.querySelector('#edit-residency-badge');
        var note = scope.querySelector('[data-residency-note]');
        if (!note) { return; }
        if (!status && !badge) { return; }

        // Add Resident has a dropdown; Edit Resident shows a read-only badge,
        // because the status there is only changed through the Make Permanent
        // / Revert button. Either way this needs to know which status applies.
        function currentStatus() {
            if (status) { return status.value; }
            return badge.textContent.trim().toLowerCase() === 'temporary' ? 'temporary' : 'permanent';
        }

        function describe(start, today) {
            var years = today.getFullYear() - start.getFullYear();
            var months = today.getMonth() - start.getMonth();
            var days = today.getDate() - start.getDate();

            if (days < 0) {
                months--;
                days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
            }
            if (months < 0) {
                years--;
                months += 12;
            }

            var parts = [];
            if (years)  { parts.push(years + ' year' + (years === 1 ? '' : 's')); }
            if (months) { parts.push(months + ' month' + (months === 1 ? '' : 's')); }
            if (days)   { parts.push(days + ' day' + (days === 1 ? '' : 's')); }

            return {
                totalMonths: years * 12 + months,
                text: parts.length ? parts.join(', ') : 'less than a day'
            };
        }

        function sync() {
            note.classList.remove('field-hint-warning');

            if (!dateField.value) {
                note.textContent = 'Permanent status requires at least ' + MIN_MONTHS + ' months of residence.';
                dateField.setCustomValidity('');
                return;
            }

            var start = new Date(dateField.value + 'T00:00:00');
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            if (isNaN(start.getTime()) || start > today) {
                note.textContent = 'Pick a date that is not in the future.';
                note.classList.add('field-hint-warning');
                dateField.setCustomValidity('The residency start date cannot be in the future.');
                return;
            }

            var span = describe(start, today);

            if (currentStatus() === 'permanent' && span.totalMonths < MIN_MONTHS) {
                note.textContent = 'Residing here for ' + span.text + '. That is under the '
                    + MIN_MONTHS + '-month minimum, so this person cannot be recorded as Permanent yet.'
                    + ' Choose Temporary and change the status later.';
                note.classList.add('field-hint-warning');
                dateField.setCustomValidity('A permanent resident needs at least ' + MIN_MONTHS + ' months of residence.');
            } else {
                note.textContent = 'Residing here for ' + span.text + '.';
                dateField.setCustomValidity('');
            }
        }

        dateField.addEventListener('change', sync);
        dateField.addEventListener('input', sync);
        if (status) { status.addEventListener('change', sync); }
        sync();
    });

    // ---------- Special category reference ----------
    // PWD, Senior Citizen and Pregnant each need a different supporting
    // number. The field is required only while one of them is selected, so
    // the browser never blocks a submit on a hidden input.
    var REFERENCE_FIELDS = <?= json_encode(category_reference_fields(), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;

    document.querySelectorAll('[name="special_category"]').forEach(function (select) {
        var scope = select.closest('.modal-box') || document;
        var box = scope.querySelector('[data-category-reference]');
        if (!box) { return; }

        var label = box.querySelector('[data-reference-label]');
        var input = box.querySelector('[data-reference-input]');
        var format = box.querySelector('[data-reference-format]');
        var hint = box.querySelector('[data-reference-hint]');

        function sync() {
            var spec = REFERENCE_FIELDS[select.value];
            if (!spec) {
                box.style.display = 'none';
                input.required = false;
                input.removeAttribute('pattern');
                input.value = '';
                if (format) { format.textContent = ''; }
                return;
            }
            box.style.display = 'block';
            label.innerHTML = spec.label + ' <span class="req">*</span>';
            input.placeholder = spec.placeholder;
            input.required = true;

            // The format sits directly under the box, the explanation below it.
            if (format) { format.textContent = spec.format; }
            hint.textContent = spec.hint;

            if (spec.pattern) {
                input.setAttribute('pattern', spec.pattern);
                input.title = spec.error;
            } else {
                input.removeAttribute('pattern');
            }
        }

        select.addEventListener('change', sync);
        sync();
    });

    // Temporary residence only applies to a temporary resident.
    document.querySelectorAll('[name="residency_status"]').forEach(function (status) {
        var scope = status.closest('.modal-box') || document;
        var block = scope.querySelector('[data-temp-block]');
        if (!block) { return; }

        function sync() {
            var temporary = status.value === 'temporary';
            block.hidden = !temporary;

            // Disabling matters as much as hiding: a hidden `required` field
            // blocks submission with a validation message nobody can see, and
            // a disabled field posts nothing for a permanent resident.
            block.querySelectorAll('input, select').forEach(function (field) {
                field.disabled = !temporary;
                var label = field.previousElementSibling;
                var isRequired = label && label.querySelector && label.querySelector('.req');
                field.required = temporary && !!isRequired;
            });
        }
        status.addEventListener('change', sync);
        sync();
    });
})();
</script>

<?php if ($can_delete): ?>
<!-- Make permanent -->
<div class="modal-overlay" id="promote-resident-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2>Make Permanent Resident</h2>

        <p class="modal-text" id="promote-target"></p>

        <div class="alert alert-info">
            <strong>What this changes:</strong> the address they have been staying at becomes
            their permanent address on record. The address currently on file is moved to
            <a href="residency_records.php">Residency Records</a>, where it stays available.
            Their profile stops showing a separate temporary address.
            <br><br>
            This can be undone. If the claim is later disproved, revert them to temporary and
            both addresses go back exactly as they were.
        </div>

        <table class="table-compact" style="margin-bottom:18px;">
            <tr><th style="width:44%;">Address to be archived</th><td id="promote-old-address">&mdash;</td></tr>
            <tr><th>Becomes their permanent address</th><td id="promote-new-address">&mdash;</td></tr>
            <tr><th>Length of stay</th><td id="promote-duration">&mdash;</td></tr>
        </table>

        <form method="POST">
            <input type="hidden" name="promote_resident" value="1">
            <input type="hidden" name="resident_id" id="promote-resident-id" value="">

            <label for="promote_reason">Note for the record</label>
            <input type="text" id="promote_reason" name="reason" maxlength="255"
                   placeholder="Presented barangay clearance and lease dated Jan 2026">
            <small class="field-hint">Optional, but it is what a future admin will read when reviewing this change.</small>

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit">Make Permanent</button>
            </div>
        </form>
    </div>
</div>

<!-- Revert to temporary -->
<div class="modal-overlay" id="revert-resident-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2>Revert to Temporary Resident</h2>

        <p class="modal-text" id="revert-target"></p>

        <div class="alert alert-warning">
            Use this when a permanent record was granted on information that turned out to be
            false. The address archived at the time of the promotion is restored as their
            permanent address, and the address they are living at now goes back to being their
            temporary address, which reappears in their profile.
        </div>

        <table class="table-compact" style="margin-bottom:18px;">
            <tr><th style="width:44%;">Current permanent address</th><td id="revert-current-address">&mdash;</td></tr>
            <tr><th>Will be restored to</th><td id="revert-restore-address">&mdash;</td></tr>
        </table>

        <form method="POST">
            <input type="hidden" name="revert_resident" value="1">
            <input type="hidden" name="resident_id" id="revert-resident-id" value="">

            <label for="revert_reason">Reason <span class="req">*</span></label>
            <input type="text" id="revert_reason" name="reason" required maxlength="255"
                   placeholder="Lease document found to be falsified, confirmed by purok leader">
            <small class="field-hint">Required. This is kept permanently on the resident's record.</small>

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit" class="btn-danger">Revert to Temporary</button>
            </div>
        </form>
    </div>
</div>

<script>
(function () {
    var promoteModal = document.getElementById('promote-resident-modal');
    var revertModal = document.getElementById('revert-resident-modal');

    // What each promotion restores on reversion, keyed by resident id, so the
    // confirmation can show the exact address rather than a vague promise.
    var restorePoints = <?php
        $restore_points = [];
        $rp = $conn->query("SELECT resident_id, prev_address FROM resident_residency_changes
                            WHERE to_status = 'permanent' AND is_reverted = 0
                            ORDER BY changed_at ASC, change_id ASC");
        if ($rp) {
            while ($row = $rp->fetch_assoc()) {
                $restore_points[(int)$row['resident_id']] = (string)$row['prev_address'];
            }
        }
        echo json_encode($restore_points, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
    ?>;

    // The switch inside the edit form hands off to these same modals.
    var switchBtn = document.getElementById('residency-switch-btn');
    if (switchBtn) {
        switchBtn.addEventListener('click', function () {
            var infoModal = document.getElementById('edit-resident-info-modal');
            if (infoModal) { infoModal.classList.remove('active'); }

            if (switchBtn.dataset.action === 'promote') {
                document.getElementById('promote-resident-id').value = switchBtn.dataset.residentId;
                document.getElementById('promote-target').textContent =
                    'Make ' + switchBtn.dataset.residentName + ' a permanent resident.';
                document.getElementById('promote-old-address').textContent =
                    switchBtn.dataset.currentAddress || 'None on file';
                document.getElementById('promote-new-address').textContent =
                    switchBtn.dataset.tempAddress || 'None on file';
                document.getElementById('promote-duration').textContent =
                    'Checked against the 6-month minimum when you confirm.';
                document.getElementById('promote_reason').value = '';
                promoteModal.classList.add('active');
            } else {
                document.getElementById('revert-resident-id').value = switchBtn.dataset.residentId;
                document.getElementById('revert-target').textContent =
                    'Return ' + switchBtn.dataset.residentName + ' to temporary resident status.';
                document.getElementById('revert-current-address').textContent =
                    switchBtn.dataset.currentAddress || 'None on file';
                var restore = restorePoints[switchBtn.dataset.residentId];
                document.getElementById('revert-restore-address').textContent = restore
                    ? restore
                    : 'No archived address - this resident was registered as permanent, so staff will need to enter their permanent address afterwards.';
                document.getElementById('revert_reason').value = '';
                revertModal.classList.add('active');
            }
        });
    }

    document.addEventListener('click', function (e) {
        var promote = e.target.closest('[data-promote-resident]');
        if (promote && promoteModal) {
            document.getElementById('promote-resident-id').value = promote.getAttribute('data-resident-id');
            document.getElementById('promote-target').textContent =
                'Make ' + promote.getAttribute('data-resident-name') + ' a permanent resident.';
            document.getElementById('promote-old-address').textContent =
                promote.getAttribute('data-current-address') || 'None on file';
            document.getElementById('promote-new-address').textContent =
                promote.getAttribute('data-temp-address') || 'None on file';
            document.getElementById('promote-duration').textContent =
                promote.getAttribute('data-duration') || 'Unknown';
            document.getElementById('promote_reason').value = '';
            promoteModal.classList.add('active');
            return;
        }

        var revert = e.target.closest('[data-revert-resident]');
        if (revert && revertModal) {
            var id = revert.getAttribute('data-resident-id');
            document.getElementById('revert-resident-id').value = id;
            document.getElementById('revert-target').textContent =
                'Return ' + revert.getAttribute('data-resident-name') + ' to temporary resident status.';
            document.getElementById('revert-current-address').textContent =
                revert.getAttribute('data-current-address') || 'None on file';

            var restore = restorePoints[id];
            document.getElementById('revert-restore-address').textContent = restore
                ? restore
                : 'No archived address - this resident was registered as permanent, so staff will need to enter their permanent address afterwards.';

            document.getElementById('revert_reason').value = '';
            revertModal.classList.add('active');
        }
    });
})();
</script>
<?php endif; ?>

<?php require_once '../includes/footer.php'; ?>