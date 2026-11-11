<?php
/** Active review queues only; the unrelated legacy family table is not migrated. */
function api_request_review(mysqli $conn, string $kind): void {
    $user = api_staff_user($conn);
    $admin = $user['role'] === 'admin';
    $permissions = ['staff' => 'Only an administrator can review staff address changes.',
        'deletion' => 'Only an administrator can approve or reject a deletion request.'];
    if (isset($permissions[$kind]) && !$admin) api_error($permissions[$kind], 403);
    $input = api_management_input();
    $id = api_management_id($input, 'request_id');
    $action = api_management_text($input, 'action');
    if (!in_array($action, ['approve', 'reject'], true)) api_error('Invalid review action.');
    $decision = $action === 'approve' ? 'approved' : 'rejected';
    $comment = trim(api_management_text($input, 'review_comment'));
    $tables = ['resident' => 'resident_update_requests', 'staff' => 'staff_update_requests',
        'family' => 'resident_family_requests', 'deletion' => 'resident_delete_requests'];
    $missing = ['resident' => 'Request not found or already processed.',
        'staff' => 'That staff request was not found, or it has already been reviewed.',
        'family' => 'That request has already been decided.',
        'deletion' => 'That request was not found, or it has already been reviewed.'];
    $table = $tables[$kind];
    $targetTable = $kind === 'staff' ? 'staff' : 'residents';
    $targetKey = $kind === 'staff' ? 'staff_id' : 'resident_id';
    // Match profile submission/edit lock order: target first, then proposal.
    $stmt = api_management_sql($conn, "SELECT $targetKey FROM $table WHERE request_id = ?", [$id]);
    $target = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$target) api_error($missing[$kind]);
    $conn->begin_transaction();
    try {
        api_management_sql($conn, "SELECT $targetKey FROM $targetTable WHERE $targetKey = ? FOR UPDATE", [$target[$targetKey]])->close();
        $stmt = api_management_sql($conn, "SELECT * FROM $table WHERE request_id = ? AND status = 'pending' FOR UPDATE", [$id]);
        $request = $stmt->get_result()->fetch_assoc(); $stmt->close();
        if (!$request) api_staff_resident_failure($conn, $missing[$kind]);
        if ($decision === 'rejected' && isset($permissions[$kind]) && $comment === '') {
            api_staff_resident_failure($conn, 'Give a short reason when rejecting a request.');
        }
        $payload = null;
        if ($kind === 'family') {
            $payload = json_decode($request['payload'], true);
            if (!is_array($payload)) api_staff_resident_failure($conn, 'That request could not be read and was left pending.');
        }
        if ($decision === 'approved') {
            if ($kind === 'resident') api_request_apply_resident($conn, $request);
            elseif ($kind === 'staff') api_request_apply_staff($conn, $request);
            elseif ($kind === 'family') api_request_apply_family($conn, $request, $payload);
            else archive_account($conn, 'residents', (int)$request['resident_id'], (int)$_SESSION['staff_id'], $_SESSION['staff_name'] ?? '', 'Deletion request approved: ' . $request['resident_name']);
        }
        $params = [$decision, (int)$_SESSION['staff_id']];
        $named = $kind !== 'resident';
        if ($named) $params[] = $_SESSION['staff_name'] ?? ($kind === 'family' ? 'Barangay Health Officer' : '');
        array_push($params, $comment, $id);
        api_management_sql($conn, "UPDATE $table SET status = ?, reviewed_at = NOW(), reviewed_by = ?, " .
            ($named ? 'reviewed_by_name = ?, ' : '') . 'review_comment = ? WHERE request_id = ?', $params)->close();
        if ($kind === 'deletion' && $decision === 'approved') {
            api_management_sql($conn, "UPDATE resident_delete_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?,
                review_comment = 'Resolved by another request for the same resident.' WHERE resident_id = ? AND status = 'pending'",
                [(int)$_SESSION['staff_id'], $_SESSION['staff_name'] ?? '', $request['resident_id']])->close();
        }
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        api_error('That request could not be applied. Nothing was changed.', 500);
    }
    $message = 'Request has been ' . $decision . '.';
    if ($kind === 'staff') $message = 'Staff address request has been ' . $decision . '.';
    if ($kind === 'family') $message = $decision === 'approved' ? "Family details updated from the resident's request." : 'Family details request rejected. Nothing on the record changed.';
    if ($kind === 'deletion') $message = $decision === 'approved'
        ? 'Request approved. ' . $request['resident_name'] . ' was moved to Deleted Accounts and can be restored from there.'
        : 'Request rejected. The record was left untouched.';
    api_json(['ok' => true, 'data' => [], 'message' => $message, 'ui' => ['show_success' => $kind !== 'family']]);
}
