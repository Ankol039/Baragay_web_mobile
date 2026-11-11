<?php
/** Add Resident source validation, without SQL or session dependencies. */
function ac_resident_values(array $input, ?array $existing = null): array {
    // Refuse malformed transport values before passing them to the unchanged helpers.
    foreach ($input as $key => $value) {
        if (in_array($key, ['children', 'references'], true)) {
            if (!is_array($value)) profile_error('Invalid request field: ' . $key . '.');
            foreach ($value as $row) {
                if (!is_array($row)) profile_error('Invalid request field: ' . $key . '.');
                foreach ($row as $part) if (!is_string($part)) profile_error('Invalid request field: ' . $key . '.');
            }
        } elseif (!is_string($value)) profile_error('Invalid request field: ' . $key . '.');
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



    if (
        $first_name === '' || $middle_name === '' || $last_name === ''
        || $birthdate === '' || $gender === '' || $birthplace === ''
    ) {
        profile_error('Please fill in all required fields (marked with *).');
    } elseif ($family_errors) {
        // Reported one at a time so the message stays readable; the rest
        // surface as each is dealt with.
        profile_error($family_errors[0]);
    } elseif ($missing) {
        profile_error('Please fill in: ' . implode(', ', $missing) . '.');
    } elseif ($residency_status === 'temporary' && $residence_type === '') {
        profile_error('Choose the type of temporary residence.');
    } elseif (!$existing && $addr['postal_code'] !== '' && !preg_match('/^\\d{4}$/', $addr['postal_code'])) {
        profile_error('A Philippine postal code is four digits.');
    } elseif (!valid_contact_number($contact_number)) {
        profile_error('A contact number can only contain digits, spaces, +, -, and brackets.');
    } elseif ($over = array_merge(
        overlong_address_fields($addr),
        $residency_status === 'temporary' ? overlong_address_fields($temp, 'Temporary ') : []
    )) {
        profile_error('These entries are too long: ' . implode(', ', $over) . '.');
    } elseif ($special_category !== 'none' && $category_reference === '') {
        // A priority category without its supporting number cannot be verified
        // later, so the record is refused rather than saved half-complete.
        $fields = category_reference_fields();
        profile_error('Enter the ' . $fields[$special_category]['label']
               . ' for this resident, or set the category to None.');
    } elseif ($special_category !== 'none' && mb_strlen($category_reference) > 60) {
        profile_error('That reference number is too long (60 characters maximum).');
    } elseif ($special_category !== 'none' && !valid_category_reference($special_category, $category_reference)) {
        // Same rule the browser applies, repeated here so a bypassed form
        // cannot store a malformed ID.
        $fields = category_reference_fields();
        profile_error($fields[$special_category]['error']);
    } elseif ($residency_start_date === '') {
        profile_error('Enter the date this person began residing in the barangay.');
    } elseif ($residency_duration === null) {
        profile_error('The residency start date is not a valid past date.');
    } elseif ($residency_status === 'permanent'
              && (!$existing || $residency_start_date !== substr($existing['residencyStartDate'] ?? '',0,10))
              && $residency_duration['total_months'] < permanent_residency_min_months()) {
        // The rule the barangay applies: a permanent record is only opened
        // after the minimum length of stay. Anyone shorter is registered as
        // temporary and converted later.
        profile_error('This person has been residing here for only '
            . format_residency_duration($residency_duration)
            . '. A resident must complete at least ' . permanent_residency_min_months()
            . ($existing ? ' months before they can be recorded as Permanent. Revert them to Temporary first if the date is correct.' : ' months before they can be recorded as Permanent. Register them as Temporary for now, then change the status once they reach ' . permanent_residency_min_months() . ' months.'));
    } elseif ($birthdate !== '' && $residency_start_date < $birthdate) {
        profile_error('The residency start date cannot be earlier than the birthdate.');
    } elseif ($birthdate > date('Y-m-d')) {
        // A future birthdate would produce a negative age
        profile_error('Birthdate cannot be in the future.');
    }
    $h = ['occupation' => $occupation, 'hotlineNumber' => $hotline_number, 'isMarried' => (bool)$is_married, 'hasChildren' => (bool)$has_children];
    foreach (['spouse', 'father', 'mother'] as $who) {
        $person = []; foreach (person_field_keys() as $part) $person[$part] = $family_names[$who . '_' . $part];
        $h[$who] = $who === 'spouse' && !$is_married ? null : profile_map($person, PROFILE_PERSON);
    }
    return [['name' => profile_map(compact('courtesy_title','first_name','middle_name','last_name','name_extension','gender'), PROFILE_PERSON),
        'contact' => ['email' => $email, 'number' => $contact_number], 'birthdate' => ac_date($birthdate), 'birthplace' => $birthplace,
        'permanentAddress' => profile_map($addr, PROFILE_ADDRESS) + ['displayLine' => $address],
        'temporaryAddress' => $residency_status === 'temporary' ? profile_map($temp, PROFILE_ADDRESS) + ['displayLine' => $temporary_address] : null,
        'residencyStatus' => $residency_status, 'residencyStartDate' => ac_date($residency_start_date), 'residenceType' => $residence_type,
        'specialCategory' => $special_category, 'categoryReference' => $category_reference, 'household' => $h, 'lastResidencyRecordId' => null],
        ['children' => $child_rows, 'characterReferences' => $reference_rows]];
}
