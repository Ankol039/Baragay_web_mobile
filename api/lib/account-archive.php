<?php
function api_review_admin(mysqli $conn): array {
    $user = api_staff_user($conn);
    if ($user['role'] !== 'admin') api_error('Access denied.', 403);
    return $user;
}
function api_deleted_accounts(mysqli $conn): void {
    api_review_admin($conn);
    $residents = api_request_rows($conn, "SELECT r.resident_id, r.resident_number, r.courtesy_title, r.first_name, r.last_name,
        r.residency_status, r.deleted_at, r.deleted_by_name, r.delete_reason,
        (SELECT COUNT(*) FROM responses rs WHERE rs.resident_id = r.resident_id) AS response_count
        FROM residents r WHERE r.deleted_at IS NOT NULL ORDER BY r.deleted_at DESC");
    $staff = api_request_rows($conn, "SELECT staff_id, staff_number, username, courtesy_title, full_name, role,
        deleted_at, deleted_by_name, delete_reason FROM staff WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
    foreach ($residents as &$r) {
        $r['name'] = with_courtesy_title($r['courtesy_title'] ?? '', trim($r['first_name'] . ' ' . $r['last_name']));
        $r['deleted_at'] = api_request_date($r['deleted_at']);
    }
    unset($r);
    foreach ($staff as &$s) { $s['name'] = with_courtesy_title($s['courtesy_title'] ?? '', $s['full_name']); $s['deleted_at'] = api_request_date($s['deleted_at']); }
    unset($s);
    api_json(['ok' => true, 'data' => ['residents' => $residents, 'staff' => $staff]]);
}
function api_archive_action(mysqli $conn, string $action): void {
    api_review_admin($conn);
    $input = api_management_input();
    $kind = api_management_text($input, 'kind') === 'staff' ? 'staff' : 'residents';
    $id = api_management_id($input, 'id');
    $key = $kind === 'staff' ? 'staff_id' : 'resident_id';
    if ($action === 'purge' && $kind === 'staff' && $id === (int)$_SESSION['staff_id']) api_error('You cannot permanently delete the account you are signed in with.');
    $conn->begin_transaction();
    try {
        api_management_sql($conn, "SELECT $key FROM $kind WHERE $key = ? FOR UPDATE", [$id])->close();
        if ($action === 'restore') {
            $done = restore_account($conn, $kind, $id);
            if ($done && $kind === 'residents') api_management_sql($conn, "UPDATE resident_delete_requests
                SET review_comment = CONCAT(COALESCE(review_comment, ''), ' [Account later restored.]')
                WHERE resident_id = ? AND status = 'approved' AND review_comment NOT LIKE '%[Account later restored.]%'", [$id])->close();
            $message = $done ? 'Account restored. It can sign in again and its records are back in the lists.'
                : 'That account was not found in the archive, or it has already been restored.';
        } else {
            $stmt = api_management_sql($conn, "DELETE FROM $kind WHERE $key = ? AND deleted_at IS NOT NULL", [$id]);
            $done = $stmt->affected_rows > 0; $stmt->close();
            $message = $done ? 'Account permanently deleted. This one cannot be undone.' : 'That account was not found in the archive.';
        }
        $conn->commit();
    } catch (Throwable $error) { $conn->rollback(); api_error('That request could not be applied. Nothing was changed.', 500); }
    api_json(['ok' => true, 'data' => [], 'message' => $message]);
}
function api_residency_records(mysqli $conn): void {
    api_review_admin($conn);
    $filter = $_GET['filter'] ?? '';
    if (!is_string($filter) || !in_array($filter, ['permanent', 'temporary'], true)) $filter = '';
    $rows = api_request_rows($conn, "SELECT c.change_id, c.resident_id, c.from_status, c.to_status, c.prev_address, c.prev_temporary_address,
        c.reason, c.changed_at, c.is_reverted, r.resident_number, r.first_name, r.last_name, r.residency_status, s.full_name AS changed_by_name
        FROM resident_residency_changes c LEFT JOIN residents r ON r.resident_id = c.resident_id
        LEFT JOIN staff s ON s.staff_id = c.changed_by ORDER BY c.changed_at DESC, c.change_id DESC");
    $promotions = 0; $reversions = 0;
    foreach ($rows as &$r) {
        if ($r['to_status'] === 'permanent') $promotions++; else $reversions++;
        $r['name'] = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')) ?: 'Deleted resident #' . (int)$r['resident_id'];
        $r['changed_at'] = api_request_date($r['changed_at']);
    }
    unset($r);
    if ($filter !== '') $rows = array_values(array_filter($rows, fn($r) => $r['to_status'] === $filter));
    api_json(['ok' => true, 'data' => ['filter' => $filter, 'promotions' => $promotions, 'reversions' => $reversions, 'changes' => $rows]]);
}
