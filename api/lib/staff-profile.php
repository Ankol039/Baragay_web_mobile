<?php
/** Profile is an onboarding exemption, just like complete_profile.php. */
function api_staff_profile_user(mysqli $conn): array {
    $user = api_current_user($conn, true);
    if ($user['account_type'] !== 'staff') api_error('Access denied.', 403);
    return $user;
}
function api_staff_profile_data(mysqli $conn, array $user): array {
    $columns = ['staff_number', 'username', 'full_name', 'courtesy_title', 'date_hired', 'role', 'contact_number', 'email',
        'birthdate', 'gender', 'license_number', 'address', 'emergency_contact_name', 'emergency_contact_number', 'photo_path',
        'household_number', 'purok', 'street_highway', 'barangay', 'municipality', 'postal_code', 'province', 'is_first_login', 'profile_completed'];
    $stmt = api_management_sql($conn, 'SELECT ' . implode(', ', $columns) . ' FROM staff WHERE staff_id = ?', [$user['id']]);
    $account = $stmt->get_result()->fetch_assoc(); $stmt->close();
    $pending = null;
    if ($user['role'] !== 'admin') {
        $stmt = api_management_sql($conn, "SELECT address, submitted_at FROM staff_update_requests WHERE staff_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1", [$user['id']]);
        $pending = $stmt->get_result()->fetch_assoc(); $stmt->close();
    }
    $account['display_name'] = with_courtesy_title($account['courtesy_title'], $account['full_name']);
    return ['account' => $account, 'pending_request' => $pending, 'is_admin' => $user['role'] === 'admin',
        'onboarding' => $user['role'] !== 'admin' && (int)$account['profile_completed'] === 0,
        'today' => date('Y-m-d'), 'genders' => gender_options(), 'address_fields' => api_staff_address_fields()];
}
function api_staff_profile(mysqli $conn): void {
    $user = api_staff_profile_user($conn);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') api_staff_profile_save($conn, $user);
    api_json(['ok' => true, 'data' => api_staff_profile_data($conn, $user)]);
}

function api_staff_address_fields(): array {
    $fields = api_profile_metadata()['address'];
    $examples = ['0444', 'Purok 3', 'Rizal Street', 'Sapang Puke', 'Malolos', '3000', 'Bulacan'];
    foreach (array_keys($fields) as $i => $key) {
        $fields[$key]['placeholder'] = $examples[$i];
        $fields[$key]['maxlength'] = $key === 'postal_code' ? 4 : null;
    }
    return $fields;
}
