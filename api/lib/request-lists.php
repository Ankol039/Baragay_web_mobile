<?php
function api_request_rows(mysqli $conn, string $sql): array {
    $result = $conn->query($sql);
    return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
}
function api_request_date($value): string { return $value ? date('M j, Y g:i A', strtotime($value)) : ''; }
function api_request_family_details(array $payload): array {
    $rows = [['Occupation', person_field_display('occupation', $payload['occupation'] ?? '')],
        ['Hotline Number', person_field_display('hotline_number', $payload['hotline_number'] ?? '')],
        ['Marital Status', !empty($payload['is_married']) ? 'Married' : 'Not married']];
    $people = [];
    foreach (['spouse' => 'Spouse', 'father' => 'Father', 'mother' => 'Mother'] as $prefix => $label) {
        if ($prefix === 'spouse' && empty($payload['is_married'])) continue;
        $parts = [];
        foreach (person_field_keys() as $key) $parts[$key] = $payload[$prefix . '_' . $key] ?? '';
        $people[] = [$label, $parts];
    }
    foreach (['children' => 'Child', 'references' => 'Character Reference'] as $key => $label) {
        foreach (($payload[$key] ?? []) as $i => $parts) $people[] = [$label . ' ' . ($i + 1), $parts];
    }
    foreach ($people as [$label, $parts]) {
        $name = format_person_name($parts);
        if ($name !== '') $rows[] = [$label, $name . (!empty($parts['gender']) ? ' · ' . person_field_display('gender', $parts['gender']) : '')];
    }
    return $rows;
}
function api_address_requests(mysqli $conn): void {
    $user = api_staff_user($conn); $admin = $user['role'] === 'admin';
    $resident = api_request_rows($conn, "SELECT r.*, s.first_name AS resident_first_name, s.last_name AS resident_last_name
        FROM resident_update_requests r JOIN residents s ON s.resident_id = r.resident_id
        ORDER BY r.status = 'pending' DESC, r.submitted_at DESC");
    // Only fields actually displayed by the original queues cross the JSON boundary.
    $resident = array_map(function ($r) {
        $parts = [];
        foreach (address_field_names() as $key) $parts[] = $r[$key] ?? ($key === 'barangay' ? ($r['barangay_subdivision'] ?? '') : '');
        return ['request_id' => (int)$r['request_id'], 'name' => trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? '')) ?: $r['resident_first_name'] . ' ' . $r['resident_last_name'],
            'previous_address' => $r['previous_address'], 'address' => build_address_line(...$parts) ?: (string)($r['address'] ?? ''),
            'birthdate' => $r['birthdate'], 'status' => $r['status'], 'submitted_at' => $r['submitted_at']];
    }, $resident);
    $staff = []; $family = [];
    if ($admin) {
        $staff = api_request_rows($conn, "SELECT request_id, staff_name, staff_number, previous_address, address, reason, status,
            submitted_at, review_comment, reviewed_by_name FROM staff_update_requests ORDER BY status = 'pending' DESC, submitted_at DESC");
        $family = api_request_rows($conn, "SELECT fr.*, r.resident_number, r.first_name, r.middle_name, r.last_name
            FROM resident_family_requests fr JOIN residents r ON r.resident_id = fr.resident_id
            ORDER BY fr.status = 'pending' DESC, fr.requested_at DESC");
        $family = array_map(function ($r) {
            return ['request_id' => (int)$r['request_id'], 'name' => trim($r['first_name'] . ' ' . $r['middle_name'] . ' ' . $r['last_name']),
                'resident_number' => $r['resident_number'], 'status' => $r['status'], 'reason' => $r['reason'],
                'requested_at' => api_request_date($r['requested_at']), 'reviewed_at' => api_request_date($r['reviewed_at']),
                'reviewed_by_name' => $r['reviewed_by_name'], 'review_comment' => $r['review_comment'],
                'details' => api_request_family_details(json_decode($r['payload'], true) ?: [])];
        }, $family);
    }
    api_json(['ok' => true, 'data' => ['is_admin' => $admin, 'resident' => $resident, 'staff' => $staff, 'family' => $family]]);
}
function api_deletion_requests(mysqli $conn): void {
    $user = api_staff_user($conn);
    $rows = api_request_rows($conn, "SELECT dr.*, r.resident_id AS live_resident_id, r.deleted_at AS live_deleted_at
        FROM resident_delete_requests dr LEFT JOIN residents r ON r.resident_id = dr.resident_id
        ORDER BY dr.status = 'pending' DESC, dr.requested_at DESC");
    foreach ($rows as &$r) {
        $comment = trim((string)$r['review_comment']);
        $r['was_restored'] = strpos($comment, '[Account later restored.]') !== false || ($r['live_resident_id'] !== null && empty($r['live_deleted_at']) && $r['status'] === 'approved');
        $r['review_comment'] = trim(str_replace('[Account later restored.]', '', $comment));
        $r['currently_deleted'] = $r['live_resident_id'] !== null && !empty($r['live_deleted_at']);
        $r['reviewed_at'] = api_request_date($r['reviewed_at']);
    }
    unset($r);
    api_json(['ok' => true, 'data' => ['is_admin' => $user['role'] === 'admin', 'requests' => $rows]]);
}
