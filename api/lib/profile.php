<?php
/** Profile presentation/metadata, derived from the unchanged profile and helpers. */
function api_profile_metadata(): array {
    $address = [];
    foreach (address_field_labels() as $key => $label) {
        $address[$key] = ['label' => $label, 'placeholder' => address_field_placeholders()[$key],
            'maxlength' => address_field_maxlength($key), 'required' => in_array($key, required_address_fields(), true)];
    }
    return ['person' => person_field_spec(), 'address' => $address, 'titles' => courtesy_titles(),
        'contact_pattern' => contact_number_pattern(), 'hotline_pattern' => hotline_number_pattern(),
        'hotline_hint' => hotline_format_hint()];
}

function api_profile_person(array $parts): array {
    $display = [];
    foreach (person_field_keys() as $key) { $display[$key] = person_field_display($key, $parts[$key] ?? ''); }
    $display['full_name'] = format_person_name($parts);
    return $display;
}

function api_profile_data(mysqli $conn, int $id): array {
    $row = api_resident_rows($conn, 'SELECT * FROM residents WHERE resident_id = ?', $id)[0];
    $resident = [];
    $fields = ['resident_number', 'email', 'contact_number', 'birthdate', 'address', 'temporary_address',
        'residency_status', 'residence_type', 'photo_path', 'occupation', 'hotline_number'];
    $fields = array_merge($fields, person_field_keys(), address_field_names());
    foreach (address_field_names() as $key) { $fields[] = 'temp_' . $key; }
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $key) { $fields[] = $who . '_' . $key; }
    }
    foreach ($fields as $key) { $resident[$key] = (string)($row[$key] ?? ''); }
    foreach (['is_married', 'has_children'] as $key) { $resident[$key] = (string)(int)($row[$key] ?? 0); }
    $resident['children'] = fetch_person_rows($conn, 'resident_children', $id);
    $resident['references'] = fetch_person_rows($conn, 'resident_character_references', $id);
    $display = ['full_name' => with_courtesy_title($row['courtesy_title'] ?? '', build_full_name(
        $row['first_name'], $row['middle_name'] ?? '', $row['last_name'], $row['name_extension'] ?? '')),
        'gender' => gender_label($row['gender'] ?? ''), 'age' => get_resident_age_label($row['birthdate'] ?? null),
        'birthdate' => !empty($row['birthdate']) ? date('F j, Y', strtotime($row['birthdate'])) : '',
        'residence_type' => residence_type_label($row['residence_type'] ?? '')];
    foreach (['spouse', 'father', 'mother'] as $who) {
        $parts = [];
        foreach (person_field_keys() as $key) { $parts[$key] = $resident[$who . '_' . $key]; }
        $display[$who] = api_profile_person($parts);
    }
    foreach (['children', 'references'] as $key) { $display[$key] = array_map('api_profile_person', $resident[$key]); }
    $pending = api_resident_rows($conn, "SELECT request_id FROM resident_update_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1", $id);
    $family = api_resident_rows($conn, "SELECT request_id, requested_at FROM resident_family_requests WHERE resident_id = ? AND status = 'pending' ORDER BY requested_at DESC LIMIT 1", $id)[0] ?? null;
    if ($family) { $family['requested_at_label'] = date('M j, Y g:i A', strtotime($family['requested_at'])); }
    return ['resident' => $resident, 'display' => $display, 'pending_request' => (bool)$pending,
        'pending_family_request' => $family, 'today' => date('Y-m-d'), 'fields' => api_profile_metadata()];
}

function api_resident_profile(mysqli $conn): void {
    api_json(['ok' => true, 'data' => api_profile_data($conn, api_resident_id($conn))]);
}

/** Lock the owning resident, serializing pending checks even across PHP sessions. */
function api_profile_lock(mysqli $conn, int $id): array {
    $conn->begin_transaction();
    return api_resident_rows($conn, 'SELECT * FROM residents WHERE resident_id = ? FOR UPDATE', $id)[0];
}

function api_profile_insert(mysqli $conn, string $table, array $values): void {
    // All identifiers come from internal, fixed lists, never from request keys.
    $columns = implode(', ', array_keys($values));
    $marks = implode(', ', array_fill(0, count($values), '?'));
    $stmt = $conn->prepare("INSERT INTO $table ($columns) VALUES ($marks)");
    $parameters = array_values($values);
    $stmt->bind_param(str_repeat('s', count($parameters)), ...$parameters);
    $stmt->execute(); $stmt->close();
}

function api_profile_done(mysqli $conn, int $id, string $message): void {
    $conn->commit();
    api_json(['ok' => true, 'data' => api_profile_data($conn, $id), 'message' => $message]);
}

function api_resident_contact(mysqli $conn): void {
    $id = api_resident_id($conn);
    $input = api_input(['email', 'contact_number']);
    $email = trim($input['email']); $number = trim($input['contact_number']);
    if ($email === '' && $number === '') { api_error('Please provide your email or contact number to update.'); }
    if (!valid_contact_number($number)) { api_error('A contact number can only contain digits, spaces, +, -, and brackets.'); }
    $stmt = $conn->prepare('UPDATE residents SET email = ?, contact_number = ? WHERE resident_id = ?');
    $stmt->bind_param('ssi', $email, $number, $id); $stmt->execute(); $stmt->close();
    api_json(['ok' => true, 'data' => api_profile_data($conn, $id),
        'message' => 'Your email and contact information have been updated successfully.']);
}

function api_resident_birthdate_request(mysqli $conn): void {
    $id = api_resident_id($conn); $input = api_input(['birthdate']);
    $row = api_profile_lock($conn, $id); $date = trim($input['birthdate']);
    if (api_profile_has_pending($conn, $id)) { api_error('You already have a pending request under review.'); }
    if ($date === '') { api_error('Choose the corrected birthdate.'); }
    if ($date >= date('Y-m-d')) { api_error('Birthdate must be in the past.'); }
    if ($date === trim((string)($row['birthdate'] ?? ''))) { api_error('That is the birthdate already on record.'); }
    api_profile_insert($conn, 'resident_update_requests', ['resident_id' => $id, 'birthdate' => $date]);
    api_profile_done($conn, $id, 'Your birthdate correction has been sent to staff for review.');
}

function api_profile_has_pending(mysqli $conn, int $id): bool {
    return (bool)api_resident_rows($conn, "SELECT request_id FROM resident_update_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1", $id);
}
