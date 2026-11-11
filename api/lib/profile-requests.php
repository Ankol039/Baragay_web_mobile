<?php
function api_resident_name_address_request(mysqli $conn): void {
    $id = api_resident_id($conn);
    $keys = array_merge(['courtesy_title_other'], array_diff(person_field_keys(), ['gender']), address_field_names());
    foreach (address_field_names() as $key) { $keys[] = 'temp_' . $key; }
    $input = array_map('trim', api_input($keys));
    $row = api_profile_lock($conn, $id);
    $proposed = ['resident_id' => $id];
    foreach (array_diff(person_field_keys(), ['gender']) as $key) { $proposed[$key] = $input[$key]; }
    $proposed['courtesy_title'] = resolve_courtesy_title($input['courtesy_title'], $input['courtesy_title_other']);
    $parts = []; $temp = [];
    foreach (address_field_names() as $key) {
        $parts[$key] = $input[$key];
        $temp[$key] = ($row['residency_status'] ?? 'permanent') === 'temporary' ? $input['temp_' . $key] : '';
    }
    $proposed['address'] = build_address_line(...array_values($parts));
    $proposed['previous_address'] = (string)($row['address'] ?? '');
    $proposed += $parts;
    $proposed['temporary_address'] = build_address_line(...array_values($temp));
    foreach ($temp as $key => $value) { $proposed['temp_' . $key] = $value; }
    $changed = false;
    foreach (array_merge(array_diff(person_field_keys(), ['gender']), address_field_names()) as $key) {
        if ($proposed[$key] !== trim((string)($row[$key] ?? ''))) { $changed = true; }
    }
    if (($row['residency_status'] ?? 'permanent') === 'temporary') {
        foreach ($temp as $key => $value) { if ($value !== trim((string)($row['temp_' . $key] ?? ''))) { $changed = true; } }
    }
    $missing = [];
    foreach (required_address_fields() as $key) { if ($parts[$key] === '') { $missing[] = address_field_labels()[$key]; } }
    if (api_profile_has_pending($conn, $id)) { api_error('You already have a pending name/address request under review.'); }
    if ($proposed['first_name'] === '' || $proposed['last_name'] === '') { api_error('First name and last name cannot be blank.'); }
    if ($missing) { api_error('Please fill in: ' . implode(', ', $missing) . '.'); }
    if ($parts['postal_code'] !== '' && !preg_match('/^\d{4}$/', $parts['postal_code'])) { api_error('A Philippine postal code is four digits.'); }
    $over = overlong_address_fields($parts);
    if (!$over) { $over = overlong_address_fields($temp, 'Temporary '); }
    if ($over) { api_error('These entries are too long: ' . implode(', ', $over) . '.'); }
    if (!$changed) { api_error('Nothing has changed yet. Edit a name or address field before sending the request.'); }
    api_profile_insert($conn, 'resident_update_requests', $proposed);
    api_profile_done($conn, $id, 'Your name and address update request has been sent to staff for review.');
}

/** JSON adapter only; person collection/validation remains in functions.php. */
function api_profile_family_input(): array {
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
        api_error('Unsupported request content type.', 415);
    }
    try { $object = json_decode(file_get_contents('php://input'), false, 512, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { api_error('Invalid JSON request.'); }
    if (!is_object($object)) { api_error('The request body must be a JSON object.'); }
    $input = (array)$object;
    $keys = ['occupation', 'hotline_number', 'is_married', 'has_children', 'family_reason'];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (array_merge(person_field_keys(), ['courtesy_title_other']) as $key) { $keys[] = $who . '_' . $key; }
    }
    $result = [];
    foreach ($keys as $key) {
        if (isset($input[$key]) && !is_string($input[$key])) { api_error('Invalid request field: ' . $key . '.'); }
        $result[$key] = trim($input[$key] ?? '');
    }
    foreach (['children', 'references'] as $key) {
        $result[$key] = [];
        if (!is_array($input[$key] ?? [])) { api_error('Invalid request field: ' . $key . '.'); }
        foreach ($input[$key] ?? [] as $person) {
            if (!is_object($person)) { api_error('Invalid request field: ' . $key . '.'); }
            $parts = [];
            foreach (array_merge(person_field_keys(), ['courtesy_title_other']) as $field) {
                if (isset($person->$field) && !is_string($person->$field)) { api_error('Invalid request field: ' . $field . '.'); }
                $parts[$field] = $person->$field ?? '';
            }
            $result[$key][] = $parts;
        }
    }
    return $result;
}

function api_resident_family_request(mysqli $conn): void {
    $id = api_resident_id($conn); $input = api_profile_family_input();
    api_profile_lock($conn, $id);
    $pending = api_resident_rows($conn, "SELECT request_id FROM resident_family_requests WHERE resident_id = ? AND status = 'pending'", $id);
    $proposed = ['occupation' => $input['occupation'], 'hotline_number' => $input['hotline_number'],
        'is_married' => $input['is_married'] === '1' ? 1 : 0, 'has_children' => $input['has_children'] === '1' ? 1 : 0];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $key) { $proposed[$who . '_' . $key] = $input[$who . '_' . $key]; }
        $proposed[$who . '_courtesy_title'] = resolve_courtesy_title($input[$who . '_courtesy_title'], $input[$who . '_courtesy_title_other']);
    }
    if (!$proposed['is_married']) { foreach (person_field_keys() as $key) { $proposed['spouse_' . $key] = ''; } }
    $proposed['children'] = $proposed['has_children'] ? collect_person_rows($input['children']) : [];
    $proposed['references'] = collect_person_rows($input['references']);
    $problems = array_merge(person_rows_errors($proposed['children'], 'Child'), person_rows_errors($proposed['references'], 'Character reference'));
    if ($input['family_reason'] === '') { $problems[] = 'Give a short reason so staff know what you are correcting.'; }
    if ($proposed['is_married'] && $proposed['spouse_first_name'] === '') { $problems[] = 'Enter your spouse\'s first name, or answer No to "Are you married?".'; }
    if (!$proposed['references']) { $problems[] = 'At least one character reference is required.'; }
    if ($proposed['hotline_number'] !== '' && !preg_match('/' . hotline_number_pattern() . '/', $proposed['hotline_number'])) {
        $problems[] = 'Check the hotline number. ' . hotline_format_hint();
    }
    if ($pending) { $problems[] = 'You already have a change waiting for review. Staff will look at that one first.'; }
    if ($problems) { api_error($problems[0]); }
    api_profile_insert($conn, 'resident_family_requests', ['resident_id' => $id, 'payload' => json_encode($proposed), 'reason' => $input['family_reason'], 'status' => 'pending']);
    api_profile_done($conn, $id, 'Your family details change was sent to barangay staff for review.');
}
