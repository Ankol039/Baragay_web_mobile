<?php
/** Original resident actions; POST replaces the legacy mutating GET links. */
function api_staff_resident_action(mysqli $conn, string $action): void {
    $user = api_staff_user($conn);
    $input = api_management_input();
    $rid = api_management_id($input, 'resident_id');
    $input['resident_id'] = (string)$rid;
    $input['reason'] = trim(api_management_text($input, 'reason'));
    if (in_array($action, ['promote', 'revert'], true) && $user['role'] !== 'admin') api_error('Access denied.', 403);
    switch ($action) {
        case 'update': api_staff_resident_update($conn, $input); break;
        case 'promote': api_staff_resident_promote($conn, $input); break;
        case 'revert': api_staff_resident_revert($conn, $input); break;
        case 'password-reset': api_staff_resident_reset($conn, $rid); break;
        case 'toggle': api_staff_resident_toggle($conn, $rid); break;
        case 'delete': api_staff_resident_archive($conn, $rid); break;
        case 'request-delete': api_staff_resident_request_delete($conn, $rid, $input['reason']); break;
    }
}
function api_staff_resident_reset(mysqli $conn, int $rid): void {
    $stmt = api_management_sql($conn, 'SELECT resident_number FROM residents WHERE resident_id = ?', [$rid]);
    $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if ($row) {
        $hash = password_hash($row['resident_number'], PASSWORD_DEFAULT);
        api_management_sql($conn, 'UPDATE residents SET password = ?, is_first_login = 1 WHERE resident_id = ?', [$hash, $rid])->close();
    }
    api_staff_resident_success($row ? 'Password reset to default (resident number).' : '');
}
function api_staff_resident_toggle(mysqli $conn, int $rid): void {
    $stmt = api_management_sql($conn, 'SELECT is_active FROM residents WHERE resident_id = ? AND deleted_at IS NULL', [$rid]);
    $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$row) api_staff_resident_success('');
    $new_state = ((int)$row['is_active'] === 1) ? 0 : 1;
    api_management_sql($conn, 'UPDATE residents SET is_active = ? WHERE resident_id = ?', [$new_state, $rid])->close();
    api_staff_resident_success($new_state ? 'Resident account reactivated.' : 'Resident account deactivated. Their survey history has been kept.');
}
function api_staff_resident_archive(mysqli $conn, int $rid): void {
    if (!staff_is_admin()) api_error('Only an administrator can delete a resident record. Use Request Deletion instead, or deactivate the account to block access without losing their survey history.', 403);
    if ($rid <= 0) api_staff_resident_success('');
    $stmt = api_management_sql($conn, 'SELECT first_name, last_name FROM residents WHERE resident_id = ? AND deleted_at IS NULL', [$rid]);
    $target = $stmt->get_result()->fetch_assoc(); $stmt->close();
    $deleted = $target && archive_account($conn, 'residents', $rid, (int)$_SESSION['staff_id'], $_SESSION['staff_name'] ?? '', 'Deleted from the Residents page.');
    if ($deleted) {
        api_management_sql($conn, "UPDATE resident_delete_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?,
            review_comment = 'Deleted directly by an administrator.' WHERE resident_id = ? AND status = 'pending'",
            [(int)$_SESSION['staff_id'], $_SESSION['staff_name'] ?? '', $rid])->close();
    }
    api_staff_resident_success($deleted
        ? 'Resident moved to Deleted Accounts. Their survey responses were kept, and you can restore the account from there.'
        : 'Resident could not be found.');
}
function api_staff_resident_request_delete(mysqli $conn, int $rid, string $reason): void {
    // The PHP form is staff-only; its handler also accepts an administrator.
    if ($reason === '') api_error('Give a reason so the administrator can act on the request.');
    $stmt = api_management_sql($conn, 'SELECT resident_number, first_name, last_name FROM residents WHERE resident_id = ? AND deleted_at IS NULL', [$rid]);
    $target = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$target) api_error('That resident could not be found.');
    $stmt = api_management_sql($conn, "SELECT 1 FROM resident_delete_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1", [$rid]);
    $pending = $stmt->get_result()->num_rows > 0; $stmt->close();
    if ($pending) api_staff_resident_success('A deletion request for this resident is already waiting for the administrator.');
    $name = preg_replace('/\s+/', ' ', trim($target['first_name'] . ' ' . $target['last_name']));
    api_management_sql($conn, 'INSERT INTO resident_delete_requests (resident_id, resident_number, resident_name, reason, requested_by, requested_by_name) VALUES (?, ?, ?, ?, ?, ?)',
        [$rid, $target['resident_number'], $name, $reason, (int)$_SESSION['staff_id'], $_SESSION['staff_name'] ?? ''])->close();
    api_staff_resident_success('Deletion request sent to the administrator for ' . $name . '. The account is untouched until they decide.');
}
function api_staff_resident_success(string $message): void {
    api_json(['ok' => true, 'data' => [], 'message' => $message, 'redirect' => '/staff/resident-management']);
}
function api_staff_resident_failure(mysqli $conn, string $message, int $status = 400): void {
    $conn->rollback();
    api_error($message, $status);
}
function api_staff_resident_input(array $input): void {
    foreach ($input as $key => $value) {
        if (in_array($key, ['children', 'references'], true)) {
            if (!is_array($value)) api_error('Invalid request field: ' . $key . '.');
            foreach ($value as $row) {
                if (!is_array($row)) api_error('Invalid request field: ' . $key . '.');
                foreach ($row as $part) if (!is_string($part)) api_error('Invalid request field: ' . $key . '.');
            }
        } elseif (!is_string($value)) api_error('Invalid request field: ' . $key . '.');
    }
}
