<?php
/** Selective application copied from staff/address_requests.php; caller owns the transaction. */
function api_request_apply_resident(mysqli $conn, array $request): void {
    // A birthdate-only request carries no address parts. Writing them
    // anyway would blank the resident's stored address.
    $carries_address = trim((string)($request['household_number'] ?? '')) !== '';

    // Write the seven parts onto the resident and rebuild the
    // display line from them, so the parts stay the source of truth.
    $approved_address = build_address_line(
        $request['household_number'], $request['purok'], $request['street_highway'],
        $request['barangay'], $request['municipality'], $request['postal_code'], $request['province']
    );
    if ($approved_address === '') {
        $approved_address = (string)($request['address'] ?? '');
    }

    if ($carries_address) {
        $update_resident = $conn->prepare(
            "UPDATE residents
                SET household_number = ?, purok = ?, street_highway = ?, barangay = ?,
                    municipality = ?, postal_code = ?, province = ?, address = ?
              WHERE resident_id = ?"
        );
        $update_resident->bind_param(
            'ssssssssi',
            $request['household_number'], $request['purok'], $request['street_highway'],
            $request['barangay'], $request['municipality'], $request['postal_code'],
            $request['province'], $approved_address, $request['resident_id']
        );
        $update_resident->execute();
        $update_resident->close();
    }

    // Same treatment for the temporary address, when the request
    // carried one. A resident who only fixed their permanent address
    // must not have their temporary one wiped.
    $carries_temp = trim((string)($request['temp_household_number'] ?? '')) !== '';
    if ($carries_temp) {
        $approved_temp_address = build_address_line(
            $request['temp_household_number'], $request['temp_purok'], $request['temp_street_highway'],
            $request['temp_barangay'], $request['temp_municipality'], $request['temp_postal_code'],
            $request['temp_province']
        );
        if ($approved_temp_address === '') {
            $approved_temp_address = (string)($request['temporary_address'] ?? '');
        }
        $update_temp = $conn->prepare(
            "UPDATE residents
                SET temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                    temp_municipality = ?, temp_postal_code = ?, temp_province = ?, temporary_address = ?
              WHERE resident_id = ?"
        );
        $update_temp->bind_param(
            'ssssssssi',
            $request['temp_household_number'], $request['temp_purok'], $request['temp_street_highway'],
            $request['temp_barangay'], $request['temp_municipality'], $request['temp_postal_code'],
            $request['temp_province'], $approved_temp_address, $request['resident_id']
        );
        $update_temp->execute();
        $update_temp->close();
    }

    // Name parts are only touched when the request actually carried
    // them. A birthdate-only request leaves the name alone.
    $approved_first_name = trim((string)($request['first_name'] ?? ''));
    $approved_last_name = trim((string)($request['last_name'] ?? ''));
    if ($approved_first_name !== '' || $approved_last_name !== '') {
        $update_name = $conn->prepare("UPDATE residents
                SET courtesy_title = ?, first_name = ?, middle_name = ?, last_name = ?, name_extension = ?
              WHERE resident_id = ?");
        $update_name->bind_param('sssssi',
            $request['courtesy_title'], $approved_first_name, $request['middle_name'],
            $approved_last_name, $request['name_extension'], $request['resident_id']);
        $update_name->execute();
        $update_name->close();
    }

    // A birthdate correction arrives as its own request.
    if (!empty($request['birthdate'])) {
        $update_birthdate = $conn->prepare("UPDATE residents SET birthdate = ? WHERE resident_id = ?");
        $update_birthdate->bind_param('si', $request['birthdate'], $request['resident_id']);
        $update_birthdate->execute();
        $update_birthdate->close();
    }
}
function api_request_apply_family(mysqli $conn, array $request, array $payload): void {
    $target_id = (int)$request['resident_id'];

    $columns = ['occupation', 'hotline_number'];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $field) {
            $columns[] = $who . '_' . $field;
        }
    }

    $set = [];
    $values = [];
    foreach ($columns as $column) {
        $set[] = "`$column` = ?";
        $values[] = (string)($payload[$column] ?? '');
    }
    $set[] = '`is_married` = ?';
    $set[] = '`has_children` = ?';
    $married_flag = !empty($payload['is_married']) ? 1 : 0;
    $children_flag = !empty($payload['has_children']) ? 1 : 0;

    $sql = 'UPDATE residents SET ' . implode(', ', $set) . ' WHERE resident_id = ?';
    $update = $conn->prepare($sql);
    $types = str_repeat('s', count($values)) . 'iii';
    $params = $values;
    $params[] = $married_flag;
    $params[] = $children_flag;
    $params[] = $target_id;
    $update->bind_param($types, ...$params);
    $update->execute();
    $update->close();

    replace_person_rows($conn, 'resident_children', $target_id, $payload['children'] ?? []);
    replace_person_rows($conn, 'resident_character_references', $target_id, $payload['references'] ?? []);
}
function api_request_apply_staff(mysqli $conn, array $request): void {
    $parts = [];
    foreach (address_field_names() as $key) $parts[$key] = $request[$key] ?? null;
    $sets = array_map(fn($key) => "`$key` = ?", array_keys($parts));
    api_management_sql($conn, 'UPDATE staff SET ' . implode(', ', $sets) . ', address = ? WHERE staff_id = ?',
        array_merge(array_values($parts), [build_address_line(...array_values($parts)), $request['staff_id']]))->close();
}
