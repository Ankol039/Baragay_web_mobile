<?php
/** List presentation only: no edit payloads or password hashes cross this boundary. */
function api_staff_residents(mysqli $conn): void {
    $user = api_staff_user($conn);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') api_staff_resident_add($conn, api_management_input());
    $pending = array_column($conn->query("SELECT resident_id FROM resident_delete_requests WHERE status = 'pending'")->fetch_all(MYSQLI_ASSOC), 'resident_id');
    $residents = $conn->query('SELECT resident_id, resident_number, first_name, last_name, gender, birthdate,
        special_category, category_reference, contact_number, address, residency_status, is_active, is_first_login
        FROM residents WHERE deleted_at IS NULL ORDER BY resident_number, last_name, first_name')->fetch_all(MYSQLI_ASSOC);
    $categories = ['none' => 'N/A', 'pwd' => 'PWD', 'senior_citizen' => 'Senior Citizen', 'pregnant' => 'Pregnant'];
    foreach ($residents as &$row) {
        $row['full_name'] = preg_replace('/\s+/', ' ', trim($row['first_name'] . ' ' . $row['last_name']));
        $row['age'] = get_resident_age_label($row['birthdate'] ?? null);
        $row['gender_label'] = gender_label($row['gender'] ?? '');
        $row['category_label'] = $categories[$row['special_category'] ?? 'none'] ?? 'N/A';
        $row['residency_status'] = $row['residency_status'] === 'temporary' ? 'temporary' : 'permanent';
        $row['is_active'] = (int)($row['is_active'] ?? 1) === 1;
        $row['is_first_login'] = (bool)$row['is_first_login'];
        $row['filter'] = $row['residency_status'] . ($row['is_first_login'] ? ' pending-login' : '') . ($row['is_active'] ? '' : ' deactivated');
        $row['searchText'] = $row['resident_number'] . ' ' . $row['full_name'];
        $row['pending_delete'] = in_array($row['resident_id'], $pending);
        unset($row['birthdate'], $row['first_name'], $row['last_name'], $row['gender'], $row['special_category']);
    }
    unset($row);
    api_json(['ok' => true, 'data' => ['residents' => $residents, 'can_delete' => $user['role'] === 'admin',
        'today' => date('Y-m-d'), 'fields' => array_merge(api_profile_metadata(), [
            'genders' => gender_options(), 'residence_types' => residence_types(),
            'category_references' => category_reference_fields(), 'min_months' => permanent_residency_min_months()])]]);
}
