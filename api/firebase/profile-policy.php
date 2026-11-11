<?php
/** The resident profile's original PHP validation order and wording. */
class ProfileInputError extends RuntimeException {}
function profile_error(string $message): void { throw new ProfileInputError($message); }
function profile_strings(array $input, array $keys): array {
    $result = [];
    foreach ($keys as $key) {
        if (isset($input[$key]) && !is_string($input[$key])) profile_error('Invalid request field: ' . $key . '.');
        $result[$key] = trim($input[$key] ?? '');
    }
    return $result;
}
function profile_contact(array $input): array {
    $v = profile_strings($input, ['email', 'contact_number']);
    if ($v['email'] === '' && $v['contact_number'] === '') profile_error('Please provide your email or contact number to update.');
    if (!valid_contact_number($v['contact_number'])) profile_error('A contact number can only contain digits, spaces, +, -, and brackets.');
    return ['email' => $v['email'], 'number' => $v['contact_number']];
}
function profile_birthdate(array $input, array $resident, bool $pending): array {
    $date = profile_strings($input, ['birthdate'])['birthdate'];
    if ($pending) profile_error('You already have a pending request under review.');
    if ($date === '') profile_error('Choose the corrected birthdate.');
    if ($date >= date('Y-m-d')) profile_error('Birthdate must be in the past.');
    if ($date === substr($resident['birthdate'] ?? '', 0, 10)) profile_error('That is the birthdate already on record.');
    // Firestore DATE representation requires a real calendar date, like MySQL DATE.
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
    if (!$parsed || $parsed->format('Y-m-d') !== $date) profile_error('Choose the corrected birthdate.');
    return ['name' => null, 'birthdate' => $parsed, 'permanentAddress' => null, 'temporaryAddress' => null,
        'legacyEmail' => '', 'legacyContact' => '', 'legacyBarangaySubdivision' => ''];
}
function profile_name_address(array $input, array $resident, bool $pending): array {
    $keys = array_merge(['courtesy_title_other'], array_diff(person_field_keys(), ['gender']), address_field_names());
    foreach (address_field_names() as $key) $keys[] = 'temp_' . $key;
    $v = profile_strings($input, $keys);
    $v['courtesy_title'] = resolve_courtesy_title($v['courtesy_title'], $v['courtesy_title_other']);
    $parts = []; $temp = [];
    foreach (address_field_names() as $key) {
        $parts[$key] = $v[$key];
        $temp[$key] = $resident['residencyStatus'] === 'temporary' ? $v['temp_' . $key] : '';
    }
    $old = profile_unmap($resident['name'], PROFILE_PERSON) + profile_unmap($resident['permanentAddress'], PROFILE_ADDRESS);
    $changed = false;
    foreach (array_merge(array_diff(person_field_keys(), ['gender']), address_field_names()) as $key) {
        if ($v[$key] !== trim($old[$key])) $changed = true;
    }
    if ($resident['residencyStatus'] === 'temporary') {
        foreach (profile_unmap($resident['temporaryAddress'], PROFILE_ADDRESS) as $key => $value) if ($temp[$key] !== trim($value)) $changed = true;
    }
    $missing = [];
    foreach (required_address_fields() as $key) if ($parts[$key] === '') $missing[] = address_field_labels()[$key];
    if ($pending) profile_error('You already have a pending name/address request under review.');
    if ($v['first_name'] === '' || $v['last_name'] === '') profile_error('First name and last name cannot be blank.');
    if ($missing) profile_error('Please fill in: ' . implode(', ', $missing) . '.');
    if ($parts['postal_code'] !== '' && !preg_match('/^\d{4}$/', $parts['postal_code'])) profile_error('A Philippine postal code is four digits.');
    $over = overlong_address_fields($parts) ?: overlong_address_fields($temp, 'Temporary ');
    if ($over) profile_error('These entries are too long: ' . implode(', ', $over) . '.');
    if (!$changed) profile_error('Nothing has changed yet. Edit a name or address field before sending the request.');
    return ['name' => profile_map($v + ['gender' => $resident['name']['gender']], PROFILE_PERSON), 'birthdate' => null,
        'permanentAddress' => profile_map($parts, PROFILE_ADDRESS) + ['displayLine' => build_address_line(...array_values($parts))],
        'temporaryAddress' => $resident['residencyStatus'] === 'temporary'
            ? profile_map($temp, PROFILE_ADDRESS) + ['displayLine' => build_address_line(...array_values($temp))] : null,
        'legacyEmail' => '', 'legacyContact' => '', 'legacyBarangaySubdivision' => ''];
}
function profile_family(array $input, bool $pending): array {
    $keys = ['occupation', 'hotline_number', 'is_married', 'has_children', 'family_reason'];
    foreach (['spouse', 'father', 'mother'] as $who) foreach (array_merge(person_field_keys(), ['courtesy_title_other']) as $key) $keys[] = $who . '_' . $key;
    $v = profile_strings($input, $keys);
    $h = ['occupation' => $v['occupation'], 'hotlineNumber' => $v['hotline_number'], 'isMarried' => $v['is_married'] === '1', 'hasChildren' => $v['has_children'] === '1'];
    foreach (['spouse', 'father', 'mother'] as $who) {
        $person = [];
        foreach (person_field_keys() as $key) $person[$key] = $v[$who . '_' . $key];
        $person['courtesy_title'] = resolve_courtesy_title($person['courtesy_title'], $v[$who . '_courtesy_title_other']);
        $h[$who] = $who === 'spouse' && !$h['isMarried'] ? null : profile_map($person, PROFILE_PERSON);
    }
    $people = [];
    foreach (['children', 'references'] as $key) {
        if (!is_array($input[$key] ?? [])) profile_error('Invalid request field: ' . $key . '.');
        $rows = [];
        foreach ($input[$key] ?? [] as $row) {
            if (!is_array($row)) profile_error('Invalid request field: ' . $key . '.');
            $rows[] = profile_strings($row, array_merge(person_field_keys(), ['courtesy_title_other']));
        }
        $people[$key] = $key === 'children' && !$h['hasChildren'] ? [] : collect_person_rows($rows);
    }
    $problems = array_merge(person_rows_errors($people['children'], 'Child'), person_rows_errors($people['references'], 'Character reference'));
    if ($v['family_reason'] === '') $problems[] = 'Give a short reason so staff know what you are correcting.';
    if ($h['isMarried'] && $h['spouse']['firstName'] === '') $problems[] = 'Enter your spouse\'s first name, or answer No to "Are you married?".';
    if (!$people['references']) $problems[] = 'At least one character reference is required.';
    if ($h['hotlineNumber'] !== '' && !preg_match('/' . hotline_number_pattern() . '/', $h['hotlineNumber'])) $problems[] = 'Check the hotline number. ' . hotline_format_hint();
    if ($pending) $problems[] = 'You already have a change waiting for review. Staff will look at that one first.';
    if ($problems) profile_error($problems[0]);
    return [$h, $people, $v['family_reason']];
}
function profile_photo(array $input): string {
    $data = profile_strings($input, ['photo'])['photo'];
    if ($data === '') profile_error('Please select a photo to upload.');
    if (!preg_match('~\Adata:image/jpeg;base64,([A-Za-z0-9+/]+={0,2})\z~', $data, $match)) profile_error('Uploaded file must be a valid image.');
    $bytes = base64_decode($match[1], true);
    if ($bytes === false || !($info = @getimagesizefromstring($bytes)) || $info[2] !== IMAGETYPE_JPEG) profile_error('Uploaded file must be a valid image.');
    if (strlen($bytes) > 60 * 1024 || $info[0] > 256 || $info[1] > 256 || $info[0] !== $info[1]) profile_error('The selected photo is too large.');
    return $data;
}
