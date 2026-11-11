<?php
/** User Management: source fields and messages; mutations use POST. */
function api_staff_users(mysqli $conn): void {
    $user = api_staff_user($conn);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') api_staff_user_create($conn, $user);
    $staff = [];
    if ($user['role'] === 'admin') {
        $staff = $conn->query('SELECT staff_id, staff_number, username, full_name, courtesy_title, role, is_active, is_first_login, profile_completed FROM staff WHERE deleted_at IS NULL ORDER BY role DESC, full_name')->fetch_all(MYSQLI_ASSOC);
        foreach ($staff as &$row) {
            $row['display_name'] = with_courtesy_title($row['courtesy_title'], $row['full_name']);
            $row['is_me'] = (int)$row['staff_id'] === $user['id'];
            $row['searchText'] = trim($row['staff_number'] . ' ' . $row['username'] . ' ' . $row['full_name']);
        }
        unset($row);
    }
    $residents = $conn->query('SELECT resident_id, resident_number, first_name, last_name, residency_status, is_active FROM residents WHERE deleted_at IS NULL ORDER BY last_name, first_name')->fetch_all(MYSQLI_ASSOC);
    foreach ($residents as &$row) {
        $row['full_name'] = preg_replace('/\s+/', ' ', trim($row['first_name'] . ' ' . $row['last_name']));
        $row['searchText'] = $row['resident_number'] . ' ' . $row['full_name'];
        unset($row['first_name'], $row['last_name']);
    }
    unset($row);
    api_json(['ok' => true, 'data' => ['is_admin' => $user['role'] === 'admin', 'staff' => $staff,
        'residents' => $residents, 'pending_deletions' => $user['pending_deletions'] ?? 0,
        'titles' => courtesy_titles(), 'today' => date('Y-m-d')]]);
}
function api_staff_user_create(mysqli $conn, array $user): void {
    if ($user['role'] !== 'admin') api_error('Only administrators can create staff accounts.', 403);
    $input = array_map('trim', api_input(['first_name', 'middle_name', 'last_name', 'name_extension', 'date_hired', 'courtesy_title', 'courtesy_title_other']));
    extract($input);
    $courtesy_title = resolve_courtesy_title($courtesy_title, $courtesy_title_other);
    $full_name = build_full_name($first_name, $middle_name, $last_name, $name_extension);
    if ($first_name === '' || $last_name === '' || $date_hired === '') api_error('First name, last name, and date hired are required.');
    if ($date_hired > date('Y-m-d')) api_error('Date hired cannot be in the future.');
    // Serialize the unchanged global MAX sequence without altering its format/schema.
    $locked = $conn->query("SELECT GET_LOCK('barangay_api_staff_number', 10) AS locked")->fetch_assoc()['locked'];
    if ((int)$locked !== 1) api_error('The system is temporarily unavailable. Please try again in a few minutes.', 503);
    try {
        $staff_number = generate_staff_number($conn);
        $hash = password_hash($staff_number, PASSWORD_DEFAULT);
        api_management_sql($conn, 'INSERT INTO staff (staff_number, username, full_name, courtesy_title, first_name, middle_name, last_name, name_extension, date_hired, password, role, is_active, is_first_login, profile_completed, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?)',
            [$staff_number, $staff_number, $full_name, $courtesy_title, $first_name, $middle_name, $last_name, $name_extension, $date_hired, $hash, 'staff', $user['id']])->close();
    } finally { $conn->query("SELECT RELEASE_LOCK('barangay_api_staff_number')"); }
    // Only the creation response carries the hand-over slip. No persistent flash/storage.
    api_json(['ok' => true, 'data' => ['new_staff' => ['full_name' => with_courtesy_title($courtesy_title, $full_name), 'staff_number' => $staff_number]],
        'message' => 'Staff account created for ' . $full_name . '.']);
}
function api_staff_user_action(mysqli $conn, string $action): void {
    $user = api_staff_user($conn);
    $verbs = ['toggle' => 'deactivate staff accounts.', 'delete' => 'delete a staff account.', 'password-reset' => 'reset a staff password.'];
    if ($user['role'] !== 'admin') api_error('Only administrators can ' . $verbs[$action], 403);
    $input = api_input(['staff_id']); $id = (int)$input['staff_id'];
    if ($id === $user['id']) {
        $messages = ['toggle' => 'You cannot deactivate your own account while logged in.', 'delete' => 'You cannot delete the account you are signed in with.', 'password-reset' => 'Use Change Password to update your own password.'];
        api_error($messages[$action]);
    }
    $conn->begin_transaction();
    try {
        $stmt = api_management_sql($conn, 'SELECT staff_number, full_name, role, is_active, deleted_at FROM staff WHERE staff_id = ? FOR UPDATE', [$id]);
        $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
        $message = '';
        if ($action === 'password-reset') {
            if (!$row || !$row['staff_number']) api_staff_resident_failure($conn, 'That staff account could not be found.');
            api_management_sql($conn, 'UPDATE staff SET password = ?, is_first_login = 1 WHERE staff_id = ?', [password_hash($row['staff_number'], PASSWORD_DEFAULT), $id])->close();
            $message = 'Password reset to the Staff Number (' . $row['staff_number'] . '). They will be asked to set a new one at their next login.';
        } elseif ($action === 'delete') {
            if (!$row || $row['deleted_at'] !== null) api_staff_resident_failure($conn, 'That staff account could not be found.');
            if (strtolower(trim($row['role'])) === 'admin' && active_admin_count($conn, $id) === 0)
                api_staff_resident_failure($conn, 'This is the only administrator account left. Promote or create another administrator before deleting this one.');
            archive_account($conn, 'staff', $id, $user['id'], $_SESSION['staff_name'] ?? '', 'Deleted from User Management.');
            $message = $row['full_name'] . ' was moved to Deleted Accounts. You can restore the account from there.';
        } elseif ($row && $row['deleted_at'] === null) {
            $active = (int)$row['is_active'] === 1 ? 0 : 1;
            api_management_sql($conn, 'UPDATE staff SET is_active = ? WHERE staff_id = ?', [$active, $id])->close();
            $message = $active ? 'Staff account reactivated.' : 'Staff account deactivated.';
        }
        $conn->commit();
    } catch (Throwable $error) { $conn->rollback(); throw $error; }
    api_json(['ok' => true, 'data' => [], 'message' => $message]);
}
function api_user_resident_toggle(mysqli $conn): void {
    api_staff_user($conn);
    $input = api_input(['resident_id']); $id = (int)$input['resident_id'];
    $conn->begin_transaction();
    try {
        $stmt = api_management_sql($conn, 'SELECT is_active FROM residents WHERE resident_id = ? AND deleted_at IS NULL FOR UPDATE', [$id]);
        $row = $stmt->get_result()->fetch_assoc(); $stmt->close(); $message = '';
        if ($row) {
            $active = (int)$row['is_active'] === 1 ? 0 : 1;
            api_management_sql($conn, 'UPDATE residents SET is_active = ? WHERE resident_id = ?', [$active, $id])->close();
            $message = $active ? 'Resident account reactivated.' : 'Resident account deactivated.';
        }
        $conn->commit();
    } catch (Throwable $error) { $conn->rollback(); throw $error; }
    api_json(['ok' => true, 'data' => [], 'message' => $message]);
}
