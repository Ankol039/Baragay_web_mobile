<?php
/** Update branch from staff/resident_management.php. Saved residency status is authoritative. */
function api_staff_resident_update(mysqli $conn, array $input): void {
    api_staff_resident_input($input);
    $conn->begin_transaction();

    $occupation     = trim($input['occupation'] ?? '');
    $hotline_number = trim($input['hotline_number'] ?? '');
    $is_married     = ($input['is_married'] ?? '0') === '1' ? 1 : 0;
    $has_children   = ($input['has_children'] ?? '0') === '1' ? 1 : 0;
    $family_names = [];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $part) {
            $family_names[$who . '_' . $part] = trim($input[$who . '_' . $part] ?? '');
        }
        $family_names[$who . '_courtesy_title'] = resolve_courtesy_title(
            $family_names[$who . '_courtesy_title'],
            trim($input[$who . '_courtesy_title_other'] ?? '')
        );
    }
    if (!$is_married) {
        foreach (person_field_keys() as $part) {
            $family_names['spouse_' . $part] = '';
        }
    }
    $child_rows     = $has_children ? collect_person_rows($input['children'] ?? []) : [];
    $reference_rows = collect_person_rows($input['references'] ?? []);
    $family_errors = array_merge(
        person_rows_errors($child_rows, 'Child'),
        person_rows_errors($reference_rows, 'Character reference')
    );
    if ($is_married && $family_names['spouse_last_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s surname, or answer No to "Is this resident married?".';
    }
    if ($is_married && $family_names['spouse_first_name'] === '') {
        $family_errors[] = 'Enter the spouse\'s first name, or answer No to "Is this resident married?".';
    }
    if ($has_children && empty($child_rows)) {
        $family_errors[] = 'Add at least one child, or answer No to "Does this resident have children?".';
    }
    if (empty($reference_rows)) {
        $family_errors[] = 'At least one character reference is required.';
    }
    if ($hotline_number !== '' && !preg_match('/' . hotline_number_pattern() . '/', $hotline_number)) {
        $family_errors[] = 'Check the hotline number. ' . hotline_format_hint();
    }
    if (mb_strlen($occupation) > 100) {
        $family_errors[] = 'That occupation is too long (100 characters maximum).';
    }
    $resident_id = (int)($input['resident_id'] ?? 0);
    $first_name = trim($input['first_name'] ?? '');
    $middle_name = trim($input['middle_name'] ?? '');
    $last_name = trim($input['last_name'] ?? '');
    $name_extension = trim($input['name_extension'] ?? '');
    $email = trim($input['email'] ?? '');
    $contact_number = trim($input['contact_number'] ?? '');
    $birthdate = trim($input['birthdate'] ?? '');
    $birthplace = trim($input['birthplace'] ?? '');
    $gender = $input['gender'] ?? '';
    if (!array_key_exists($gender, gender_options())) {
        $gender = '';
    }
    $courtesy_title = resolve_courtesy_title($input['courtesy_title'] ?? '', $input['courtesy_title_other'] ?? '');
    $special_category = $input['special_category'] ?? 'none';
    if (!in_array($special_category, ['none', 'pwd', 'senior_citizen', 'pregnant'], true)) {
        $special_category = 'none';
    }
    $category_reference = $special_category === 'none' ? '' : trim($input['category_reference'] ?? '');
    $current_status = '';
    $current_start_date = '';
    $status_stmt = $conn->prepare("SELECT residency_status, residency_start_date FROM residents WHERE resident_id = ? FOR UPDATE");
    $status_stmt->bind_param('i', $resident_id);
    $status_stmt->execute();
    $status_row = $status_stmt->get_result()->fetch_assoc();
    $status_stmt->close();
    if ($status_row) {
        $current_status = $status_row['residency_status'] ?? '';
        $current_start_date = (string)($status_row['residency_start_date'] ?? '');
    }
    $residency_status = $current_status === 'temporary' ? 'temporary' : 'permanent';
    $residency_start_date = trim($input['residency_start_date'] ?? '');
    $residency_duration = residency_duration($residency_start_date);
    $residence_type = $input['residence_type'] ?? '';
    if ($residency_status !== 'temporary' || !array_key_exists($residence_type, residence_types())) {
        $residence_type = '';
    }
    $addr = [];
    foreach (address_field_names() as $field) {
        $addr[$field] = trim($input[$field] ?? '');
    }
    $address = build_address_line(
        $addr['household_number'], $addr['purok'], $addr['street_highway'],
        $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province']
    );
    $temp = [];
    foreach (address_field_names() as $field) {
        $temp[$field] = $residency_status === 'temporary' ? trim($input['temp_' . $field] ?? '') : '';
    }
    $temporary_address = build_address_line(
        $temp['household_number'], $temp['purok'], $temp['street_highway'],
        $temp['barangay'], $temp['municipality'], $temp['postal_code'], $temp['province']
    );
    $missing = [];
    foreach (required_address_fields() as $field) {
        if ($addr[$field] === '') {
            $missing[] = address_field_labels()[$field];
        }
    }
    if ($residency_status === 'temporary') {
        foreach (required_address_fields() as $field) {
            if ($temp[$field] === '') {
                $missing[] = 'Temporary ' . address_field_labels()[$field];
            }
        }
    }
    if (
        $resident_id <= 0 || $first_name === '' || $middle_name === '' || $last_name === ''
        || $birthdate === '' || $gender === '' || $birthplace === ''
    ) {
        api_staff_resident_failure($conn, 'Please fill in all required fields (marked with *).');
    } elseif ($family_errors) {
        api_staff_resident_failure($conn, $family_errors[0]);
    } elseif ($missing) {
        api_staff_resident_failure($conn, 'Please fill in: ' . implode(', ', $missing) . '.');
    } elseif ($residency_status === 'temporary' && $residence_type === '') {
        api_staff_resident_failure($conn, 'Choose the type of temporary residence.');
    } elseif (!valid_contact_number($contact_number)) {
        api_staff_resident_failure($conn, 'A contact number can only contain digits, spaces, +, -, and brackets.');
    } elseif ($over = array_merge(
        overlong_address_fields($addr),
        $residency_status === 'temporary' ? overlong_address_fields($temp, 'Temporary ') : []
    )) {
        api_staff_resident_failure($conn, 'These entries are too long: ' . implode(', ', $over) . '.');
    } elseif ($special_category !== 'none' && $category_reference === '') {
        $fields = category_reference_fields();
        api_staff_resident_failure($conn, 'Enter the ' . $fields[$special_category]['label']
               . ' for this resident, or set the category to None.');
    } elseif ($special_category !== 'none' && mb_strlen($category_reference) > 60) {
        api_staff_resident_failure($conn, 'That reference number is too long (60 characters maximum).');
    } elseif ($special_category !== 'none' && !valid_category_reference($special_category, $category_reference)) {
        $fields = category_reference_fields();
        api_staff_resident_failure($conn, $fields[$special_category]['error']);
    } elseif ($residency_start_date === '') {
        api_staff_resident_failure($conn, 'Enter the date this person began residing in the barangay.');
    } elseif ($residency_duration === null) {
        api_staff_resident_failure($conn, 'The residency start date is not a valid past date.');
    } elseif ($residency_status === 'permanent'
              && $residency_start_date !== ($current_start_date ?? '')
              && $residency_duration['total_months'] < permanent_residency_min_months()) {
        api_staff_resident_failure($conn, 'This person has been residing here for only '
            . format_residency_duration($residency_duration)
            . '. A resident must complete at least ' . permanent_residency_min_months()
            . ' months before they can be recorded as Permanent. Revert them to Temporary '
            . 'first if the date is correct.');
    } elseif ($birthdate !== '' && $residency_start_date < $birthdate) {
        api_staff_resident_failure($conn, 'The residency start date cannot be earlier than the birthdate.');
    } elseif ($birthdate > date('Y-m-d')) {
        api_staff_resident_failure($conn, 'Birthdate cannot be in the future.');
    } else {
        try {
            $stmt = $conn->prepare("UPDATE residents SET courtesy_title = ?, first_name = ?, middle_name = ?, last_name = ?,
                    name_extension = ?, email = ?, contact_number = ?, birthdate = ?, gender = ?, birthplace = ?,
                    address = ?, household_number = ?, purok = ?, street_highway = ?, barangay = ?, municipality = ?,
                    postal_code = ?, province = ?, residence_type = ?, temporary_address = ?,
                    temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                    temp_municipality = ?, temp_postal_code = ?, temp_province = ?,
                    special_category = ?, category_reference = ?, residency_status = ?, residency_start_date = ?,
                    occupation = ?, hotline_number = ?, is_married = ?,
                    spouse_courtesy_title = ?, spouse_first_name = ?, spouse_middle_name = ?,
                    spouse_last_name = ?, spouse_name_extension = ?, spouse_gender = ?,
                    has_children = ?,
                    father_courtesy_title = ?, father_first_name = ?, father_middle_name = ?,
                    father_last_name = ?, father_name_extension = ?, father_gender = ?,
                    mother_courtesy_title = ?, mother_first_name = ?, mother_middle_name = ?,
                    mother_last_name = ?, mother_name_extension = ?, mother_gender = ?
                  WHERE resident_id = ?");
            $stmt->bind_param(
                str_repeat('s', 33) . 'i' . str_repeat('s', 6) . 'i' . str_repeat('s', 12) . 'i',
                $courtesy_title, $first_name, $middle_name, $last_name, $name_extension, $email, $contact_number,
                $birthdate, $gender, $birthplace,
                $address, $addr['household_number'], $addr['purok'], $addr['street_highway'],
                $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province'],
                $residence_type, $temporary_address,
                $temp['household_number'], $temp['purok'], $temp['street_highway'], $temp['barangay'],
                $temp['municipality'], $temp['postal_code'], $temp['province'],
                $special_category, $category_reference, $residency_status, $residency_start_date,
                $occupation, $hotline_number, $is_married,
                $family_names['spouse_courtesy_title'], $family_names['spouse_first_name'],
                $family_names['spouse_middle_name'], $family_names['spouse_last_name'],
                $family_names['spouse_name_extension'], $family_names['spouse_gender'],
                $has_children,
                $family_names['father_courtesy_title'], $family_names['father_first_name'],
                $family_names['father_middle_name'], $family_names['father_last_name'],
                $family_names['father_name_extension'], $family_names['father_gender'],
                $family_names['mother_courtesy_title'], $family_names['mother_first_name'],
                $family_names['mother_middle_name'], $family_names['mother_last_name'],
                $family_names['mother_name_extension'], $family_names['mother_gender'],
                $resident_id
            );
            $stmt->execute();
            $stmt->close();
            replace_person_rows($conn, 'resident_children', $resident_id, $child_rows);
            replace_person_rows($conn, 'resident_character_references', $resident_id, $reference_rows);
            $conn->commit();
        } catch (Throwable $e) {
            error_log('Updating a resident failed (' . get_class($e) . ').');
            api_staff_resident_failure($conn, 'The changes could not be saved. Please try again.', 500);
        }
        api_staff_resident_success('Resident updated successfully.');
    }
}
