<?php
/** Allowlisted edit lookup, including the related rows rebuilt by the PHP modal. */
function api_staff_resident_detail(mysqli $conn): void {
    $user = api_staff_user($conn);
    $id = api_management_id($_GET, 'id');
    $columns = array_merge(['resident_id', 'resident_number', 'courtesy_title', 'first_name', 'middle_name',
        'last_name', 'name_extension', 'email', 'contact_number', 'birthdate', 'gender', 'birthplace',
        'address', 'temporary_address', 'residence_type', 'special_category', 'category_reference',
        'residency_status', 'residency_start_date', 'occupation', 'hotline_number', 'is_married', 'has_children'],
        address_field_names(), array_map(fn($key) => 'temp_' . $key, address_field_names()));
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $key) $columns[] = $who . '_' . $key;
    }
    $stmt = api_management_sql($conn, 'SELECT ' . implode(', ', $columns) . ' FROM residents WHERE resident_id = ? AND deleted_at IS NULL LIMIT 1', [$id]);
    $resident = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$resident) api_error('The selected resident could not be loaded.', 404);
    $resident['children'] = fetch_person_rows($conn, 'resident_children', $id);
    $resident['references'] = fetch_person_rows($conn, 'resident_character_references', $id);
    $restore = null;
    if ($user['role'] === 'admin') {
        $stmt = api_management_sql($conn, "SELECT prev_address FROM resident_residency_changes WHERE resident_id = ? AND to_status = 'permanent' AND is_reverted = 0 ORDER BY changed_at DESC, change_id DESC LIMIT 1", [$id]);
        $restore = $stmt->get_result()->fetch_assoc()['prev_address'] ?? null; $stmt->close();
    }
    api_json(['ok' => true, 'data' => ['resident' => $resident, 'restore_address' => $restore]]);
}
