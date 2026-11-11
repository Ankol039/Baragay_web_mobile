<?php
/** Add branch of staff/resident_management.php; original validation order and transaction. */
function api_staff_resident_add(mysqli $conn, array $input): void {
    $error = '';
    // Refuse malformed transport values before passing them to the unchanged helpers.
    foreach ($input as $key => $value) {
        if (in_array($key, ['children', 'references'], true)) {
            if (!is_array($value)) api_error('Invalid request field: ' . $key . '.');
            foreach ($value as $row) {
                if (!is_array($row)) api_error('Invalid request field: ' . $key . '.');
                foreach ($row as $part) if (!is_string($part)) api_error('Invalid request field: ' . $key . '.');
            }
        } elseif (!is_string($value)) api_error('Invalid request field: ' . $key . '.');
    }
    /* ------------------------------------------------------------------
       Family and household details.

       Spouse and parents are single names read straight off the form.
       Children and character references repeat, so they come back as a
       list with the blank rows already dropped.

       A spouse name is only kept when the answer to "is this resident
       married" was Yes, and children only when the answer was Yes — an
       answer of No clears anything typed before the radio was changed,
       so a stray name cannot survive on a record that says No.
       ------------------------------------------------------------------ */
    $occupation     = trim($input['occupation'] ?? '');
    $hotline_number = trim($input['hotline_number'] ?? '');
    $is_married     = ($input['is_married'] ?? '0') === '1' ? 1 : 0;
    $has_children   = ($input['has_children'] ?? '0') === '1' ? 1 : 0;

    $family_names = [];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $part) {
            $family_names[$who . '_' . $part] = trim($input[$who . '_' . $part] ?? '');
        }
        // "Others" hands over to the box beside it, the same way the
        // resident's own courtesy title does.
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

    // A married resident with no spouse name recorded is almost always a
    // half-finished form rather than a deliberate blank.
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

    $current_year = date('Y');

    // Grab the absolute highest sequence number after the dash, regardless of the year
    $stmt = $conn->prepare("SELECT MAX(CAST(SUBSTRING_INDEX(resident_number, '-', -1) AS UNSIGNED)) as max_seq FROM residents");
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Increment from the highest existing number, or start at 1 if database is empty
    $next_seq = ($result && $result['max_seq']) ? (int)$result['max_seq'] + 1 : 1;

    // Format the number to maintain 4 digits (e.g., R-YYYY-0003)
    $resident_number = 'R-' . $current_year . '-' . str_pad($next_seq, 4, '0', STR_PAD_LEFT);

    $first_name = trim($input['first_name'] ?? '');
    $middle_name = trim($input['middle_name'] ?? '');
    $last_name = trim($input['last_name'] ?? '');
    $name_extension = trim($input['name_extension'] ?? '');
    $email = trim($input['email'] ?? '');
    $contact_number = trim($input['contact_number'] ?? '');
    $birthdate = trim($input['birthdate'] ?? '');
    $birthplace = trim($input['birthplace'] ?? '');

    // Gender - whitelist the submitted value, never trust the dropdown
    $gender = $input['gender'] ?? '';
    if (!array_key_exists($gender, gender_options())) {
        $gender = '';
    }

    $courtesy_title = resolve_courtesy_title($input['courtesy_title'] ?? '', $input['courtesy_title_other'] ?? '');

    $special_category = $input['special_category'] ?? 'none';
    if (!in_array($special_category, ['none', 'pwd', 'senior_citizen', 'pregnant'], true)) {
        $special_category = 'none';
    }

    // The reference only belongs to a real category; choosing None clears any
    // number left behind by a previous selection.
    $category_reference = $special_category === 'none' ? '' : trim($input['category_reference'] ?? '');

    $residency_status = ($input['residency_status'] ?? 'permanent') === 'temporary' ? 'temporary' : 'permanent';

    // Date the person began residing here. Required for permanent status,
    // which the barangay only grants after a minimum length of stay.
    $residency_start_date = trim($input['residency_start_date'] ?? '');
    $residency_duration = residency_duration($residency_start_date);

    // Residence type only applies to a temporary resident. Clearing it for a
    // permanent one stops a stale "Boarding House" surviving a status change.
    $residence_type = $input['residence_type'] ?? '';
    if ($residency_status !== 'temporary' || !array_key_exists($residence_type, residence_types())) {
        $residence_type = '';
    }

    // Permanent address, seven parts.
    $addr = [];
    foreach (address_field_names() as $field) {
        $addr[$field] = trim($input[$field] ?? '');
    }
    $address = build_address_line(
        $addr['household_number'], $addr['purok'], $addr['street_highway'],
        $addr['barangay'], $addr['municipality'], $addr['postal_code'], $addr['province']
    );

    // Temporary address, same seven parts, only collected when temporary.
    $temp = [];
    foreach (address_field_names() as $field) {
        $temp[$field] = $residency_status === 'temporary' ? trim($input['temp_' . $field] ?? '') : '';
    }
    $temporary_address = build_address_line(
        $temp['household_number'], $temp['purok'], $temp['street_highway'],
        $temp['barangay'], $temp['municipality'], $temp['postal_code'], $temp['province']
    );

    // Collect every missing required field at once rather than revealing
    // them one submission at a time.
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

    ensure_resident_birthdate_column($conn);

    if (
        $first_name === '' || $middle_name === '' || $last_name === ''
        || $birthdate === '' || $gender === '' || $birthplace === ''
    ) {
        api_error('Please fill in all required fields (marked with *).');
    } elseif ($family_errors) {
        // Reported one at a time so the message stays readable; the rest
        // surface as each is dealt with.
        api_error($family_errors[0]);
    } elseif ($missing) {
        api_error('Please fill in: ' . implode(', ', $missing) . '.');
    } elseif ($residency_status === 'temporary' && $residence_type === '') {
        api_error('Choose the type of temporary residence.');
    } elseif ($addr['postal_code'] !== '' && !preg_match('/^\\d{4}$/', $addr['postal_code'])) {
        api_error('A Philippine postal code is four digits.');
    } elseif (!valid_contact_number($contact_number)) {
        api_error('A contact number can only contain digits, spaces, +, -, and brackets.');
    } elseif ($over = array_merge(
        overlong_address_fields($addr),
        $residency_status === 'temporary' ? overlong_address_fields($temp, 'Temporary ') : []
    )) {
        api_error('These entries are too long: ' . implode(', ', $over) . '.');
    } elseif ($special_category !== 'none' && $category_reference === '') {
        // A priority category without its supporting number cannot be verified
        // later, so the record is refused rather than saved half-complete.
        $fields = category_reference_fields();
        api_error('Enter the ' . $fields[$special_category]['label']
               . ' for this resident, or set the category to None.');
    } elseif ($special_category !== 'none' && mb_strlen($category_reference) > 60) {
        api_error('That reference number is too long (60 characters maximum).');
    } elseif ($special_category !== 'none' && !valid_category_reference($special_category, $category_reference)) {
        // Same rule the browser applies, repeated here so a bypassed form
        // cannot store a malformed ID.
        $fields = category_reference_fields();
        api_error($fields[$special_category]['error']);
    } elseif ($residency_start_date === '') {
        api_error('Enter the date this person began residing in the barangay.');
    } elseif ($residency_duration === null) {
        api_error('The residency start date is not a valid past date.');
    } elseif ($residency_status === 'permanent'
              && $residency_duration['total_months'] < permanent_residency_min_months()) {
        // The rule the barangay applies: a permanent record is only opened
        // after the minimum length of stay. Anyone shorter is registered as
        // temporary and converted later.
        api_error('This person has been residing here for only '
            . format_residency_duration($residency_duration)
            . '. A resident must complete at least ' . permanent_residency_min_months()
            . ' months before they can be recorded as Permanent. Register them as Temporary for now,'
            . ' then change the status once they reach ' . permanent_residency_min_months() . ' months.');
    } elseif ($birthdate !== '' && $residency_start_date < $birthdate) {
        api_error('The residency start date cannot be earlier than the birthdate.');
    } elseif ($birthdate > date('Y-m-d')) {
        // A future birthdate would produce a negative age
        api_error('Birthdate cannot be in the future.');
    } else {
        $stmt = $conn->prepare("SELECT 1 FROM residents WHERE resident_number = ?");
        $stmt->bind_param('s', $resident_number);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            api_error('A resident with the generated Resident Number already exists. Please try again.');
        }
        $stmt->close();

        if (!$error) {
            $default_hash = password_hash($resident_number, PASSWORD_DEFAULT);

            /* The resident and their children and references go in together:
               a resident saved without the character references that were
               required to create them would be a half-made record. */
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("
                    INSERT INTO residents (
                        resident_number, courtesy_title, first_name, middle_name, last_name, name_extension,
                        email, contact_number, birthdate, gender, birthplace,
                        address, household_number, purok, street_highway, barangay, municipality, postal_code, province,
                        residence_type, temporary_address,
                        temp_household_number, temp_purok, temp_street_highway, temp_barangay,
                        temp_municipality, temp_postal_code, temp_province,
                        special_category, category_reference, residency_status, residency_start_date,
                        occupation, hotline_number, is_married,
                        spouse_courtesy_title, spouse_first_name, spouse_middle_name, spouse_last_name,
                        spouse_name_extension, spouse_gender,
                        has_children,
                        father_courtesy_title, father_first_name, father_middle_name, father_last_name,
                        father_name_extension, father_gender,
                        mother_courtesy_title, mother_first_name, mother_middle_name, mother_last_name,
                        mother_name_extension, mother_gender,
                        password
                    )
                    VALUES (" . rtrim(str_repeat('?,', 55), ',') . ")
                ");
                /* 32 strings up to residency_start_date, occupation and hotline,
                   the married flag, six spouse fields, the children flag, six
                   father then six mother fields, and the password hash. */
                $stmt->bind_param(
                    str_repeat('s', 32) . 'ssi' . str_repeat('s', 6) . 'i' . str_repeat('s', 13),
                    $resident_number, $courtesy_title, $first_name, $middle_name, $last_name, $name_extension,
                    $email, $contact_number, $birthdate, $gender, $birthplace,
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
                    $default_hash
                );
                $stmt->execute();
                $new_resident_id = $conn->insert_id;
                $stmt->close();

                replace_person_rows($conn, 'resident_children', $new_resident_id, $child_rows);
                replace_person_rows($conn, 'resident_character_references', $new_resident_id, $reference_rows);

                $conn->commit();
            } catch (Throwable $e) {
                $conn->rollback();
                error_log('Adding a resident failed: ' . $e->getMessage());
                api_error('The resident could not be saved. Please try again.', 500);
            }

            if (!$error) {
                // 2. Set flash message and redirect to a clean URL (this fixes the reload bug!)
                api_json(['ok' => true, 'data' => ['resident_id' => $new_resident_id, 'resident_number' => $resident_number],
                    'message' => 'Resident added successfully. Their auto-generated Resident Number (and default password) is: ',
                    'redirect' => '/staff/resident-management']);
            }
        }
    }
}
