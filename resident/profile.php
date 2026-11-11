<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$page_title = 'My Profile';
$asset_path = '../';
$resident_id = $_SESSION['resident_id'];
$message = $_SESSION['profile_flash_message'] ?? '';
$error = $_SESSION['profile_flash_error'] ?? '';
$upload_error = '';
$show_contact_modal = false;
$show_request_modal = (bool)($_SESSION['profile_show_request_modal'] ?? false);
$show_birthdate_modal = (bool)($_SESSION['profile_show_birthdate_modal'] ?? false);
$show_upload_modal = false;
$show_success_modal = false;

unset($_SESSION['profile_flash_message'], $_SESSION['profile_flash_error'],
      $_SESSION['profile_show_request_modal'], $_SESSION['profile_show_birthdate_modal']);

// Load the resident up front: the name/address request below compares the
// submitted values against the saved ones, so this must run before POST handling.
$stmt = $conn->prepare("SELECT * FROM residents WHERE resident_id = ?");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$resident = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    /**
     * Discard the photo and fall back to the initial-letter avatar.
     * The file is removed from disk too, not just unlinked from the record.
     */
    if (isset($_POST['remove_photo'])) {
        if (!empty($resident['photo_path'])) {
            $old_file = __DIR__ . '/../' . $resident['photo_path'];
            if (is_file($old_file)) {
                @unlink($old_file);
            }
        }
        $stmt = $conn->prepare('UPDATE residents SET photo_path = NULL WHERE resident_id = ?');
        $stmt->bind_param('i', $resident_id);
        $stmt->execute();
        $stmt->close();

        $resident['photo_path'] = null;
        $_SESSION['resident_photo'] = null;
        $_SESSION['profile_flash_success'] = 'Profile photo removed. Your initial is shown instead.';
        header('Location: profile.php');
        exit;
    }

    if (isset($_POST['upload_photo'])) {
        $show_upload_modal = true;
        if (empty($_FILES['profile_photo']) || !isset($_FILES['profile_photo']['error'])) {
            $upload_error = 'Please select a photo to upload.';
        } elseif ($_FILES['profile_photo']['error'] !== UPLOAD_ERR_OK) {
            switch ($_FILES['profile_photo']['error']) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $upload_error = 'The selected photo is too large.';
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $upload_error = 'The upload was interrupted. Please try again.';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $upload_error = 'Please select a photo to upload.';
                    break;
                default:
                    $upload_error = 'There was a problem uploading your photo. Please try again.';
            }
        } else {
            $file = $_FILES['profile_photo'];
            $file_tmp = $file['tmp_name'];
            $file_info = getimagesize($file_tmp);
            $allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            $file_name = basename($file['name']);
            $file_ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));

            if ($file_info === false) {
                $upload_error = 'Uploaded file must be a valid image.';
            } elseif (!in_array($file_ext, $allowed_extensions, true)) {
                $upload_error = 'Only JPG, PNG, GIF, or WEBP images are allowed.';
            } else {
                $upload_dir = __DIR__ . '/../uploads/residents';
                if (!is_dir($upload_dir) && !mkdir($upload_dir, 0755, true)) {
                    $upload_error = 'Unable to create the upload directory. Please contact support.';
                } else {
                    $unique_name = 'resident_' . $resident_id . '_' . time() . '.' . $file_ext;
                    $destination = $upload_dir . '/' . $unique_name;

                    if (!move_uploaded_file($file_tmp, $destination)) {
                        $upload_error = 'Unable to save the uploaded photo. Please try again.';
                    } else {
                        $photo_path = 'uploads/residents/' . $unique_name;
                        $stmt = $conn->prepare('UPDATE residents SET photo_path = ? WHERE resident_id = ?');
                        $stmt->bind_param('si', $photo_path, $resident_id);
                        $stmt->execute();
                        $stmt->close();

                        $resident['photo_path'] = $photo_path;
                        $message = 'Profile photo uploaded successfully.';
                        $show_success_modal = true;
                        $show_upload_modal = false;
                    }
                }
            }
        }
    } else {
        $action = $_POST['action'] ?? '';

        if ($action === 'save_contact') {
            $email = trim($_POST['email'] ?? '');
            $contact_number = trim($_POST['contact_number'] ?? '');

            if ($email === '' && $contact_number === '') {
                $error = 'Please provide your email or contact number to update.';
                $show_contact_modal = true;
            } elseif (!valid_contact_number($contact_number)) {
                $error = 'A contact number can only contain digits, spaces, +, -, and brackets.';
                $show_contact_modal = true;
            } else {
                $stmt = $conn->prepare("UPDATE residents SET email = ?, contact_number = ? WHERE resident_id = ?");
                $stmt->bind_param('ssi', $email, $contact_number, $resident_id);
                $stmt->execute();
                $stmt->close();

                $resident['email'] = $email;
                $resident['contact_number'] = $contact_number;
                $message = 'Your email and contact information have been updated successfully.';
            }
        } elseif ($action === 'request_birthdate') {
            // Birthdate drives the displayed age and senior-citizen
            // eligibility, so it is reviewed rather than self-served, the
            // same way a name or address change is.
            $new_birthdate = trim($_POST['birthdate'] ?? '');
            $current_birthdate = trim((string)($resident['birthdate'] ?? ''));

            $pending_check = $conn->prepare("SELECT request_id FROM resident_update_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1");
            $pending_check->bind_param('i', $resident_id);
            $pending_check->execute();
            $pending_exists = $pending_check->get_result()->fetch_assoc() !== null;
            $pending_check->close();

            if ($pending_exists) {
                $_SESSION['profile_flash_error'] = 'You already have a pending request under review.';
                $_SESSION['profile_show_birthdate_modal'] = true;
            } elseif ($new_birthdate === '') {
                $_SESSION['profile_flash_error'] = 'Choose the corrected birthdate.';
                $_SESSION['profile_show_birthdate_modal'] = true;
            } elseif ($new_birthdate >= date('Y-m-d')) {
                $_SESSION['profile_flash_error'] = 'Birthdate must be in the past.';
                $_SESSION['profile_show_birthdate_modal'] = true;
            } elseif ($new_birthdate === $current_birthdate) {
                $_SESSION['profile_flash_error'] = 'That is the birthdate already on record.';
                $_SESSION['profile_show_birthdate_modal'] = true;
            } else {
                $request = $conn->prepare("INSERT INTO resident_update_requests (resident_id, birthdate) VALUES (?, ?)");
                $request->bind_param('is', $resident_id, $new_birthdate);
                $request->execute();
                $request->close();

                $_SESSION['profile_flash_message'] = 'Your birthdate correction has been sent to staff for review.';
            }
            header('Location: profile.php');
            exit;
        } elseif ($action === 'request_name_address') {
            $first_name = trim($_POST['first_name'] ?? '');
            $last_name = trim($_POST['last_name'] ?? '');
            $middle_name = trim($_POST['middle_name'] ?? '');
            $name_extension = trim($_POST['name_extension'] ?? '');
            $courtesy_title = resolve_courtesy_title($_POST['courtesy_title'] ?? '', $_POST['courtesy_title_other'] ?? '');

            // Read the seven parts by name. They are compared against the
            // resident's stored columns, not against a reassembled string —
            // that string comparison is what used to report "no changes
            // detected" whenever an address had a different comma count.
            $parts = [];
            foreach (address_field_names() as $field) {
                $parts[$field] = trim($_POST[$field] ?? '');
            }

            $address = build_address_line(
                $parts['household_number'], $parts['purok'], $parts['street_highway'],
                $parts['barangay'], $parts['municipality'], $parts['postal_code'], $parts['province']
            );

            // A temporary resident also has the address they are actually
            // staying at. It is the one the health center uses to find them,
            // so it needs the same review route as the permanent one.
            $is_temporary_resident = ($resident['residency_status'] ?? 'permanent') === 'temporary';
            $temp_parts = [];
            foreach (address_field_names() as $field) {
                $temp_parts[$field] = $is_temporary_resident ? trim($_POST['temp_' . $field] ?? '') : '';
            }
            $temporary_address = build_address_line(
                $temp_parts['household_number'], $temp_parts['purok'], $temp_parts['street_highway'],
                $temp_parts['barangay'], $temp_parts['municipality'], $temp_parts['postal_code'], $temp_parts['province']
            );
            $temp_changed = false;
            if ($is_temporary_resident) {
                foreach (address_field_names() as $field) {
                    if ($temp_parts[$field] !== trim((string)($resident['temp_' . $field] ?? ''))) {
                        $temp_changed = true;
                        break;
                    }
                }
            }

            $name_changed = ($first_name !== $resident['first_name']
                || $last_name !== $resident['last_name']
                || $middle_name !== trim((string)($resident['middle_name'] ?? ''))
                || $name_extension !== trim((string)($resident['name_extension'] ?? ''))
                || $courtesy_title !== trim((string)($resident['courtesy_title'] ?? '')));

            // Part-by-part, so a change to any single line is detected even
            // when the joined line happens to look similar.
            $address_changed = false;
            foreach ($parts as $field => $submitted) {
                if ($submitted !== trim((string)($resident[$field] ?? ''))) {
                    $address_changed = true;
                    break;
                }
            }

            $missing = [];
            foreach (required_address_fields() as $field) {
                if ($parts[$field] === '') {
                    $missing[] = address_field_labels()[$field];
                }
            }

            $pending_check = $conn->prepare("SELECT request_id FROM resident_update_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1");
            $pending_check->bind_param('i', $resident_id);
            $pending_check->execute();
            $pending_exists = $pending_check->get_result()->fetch_assoc() !== null;
            $pending_check->close();

            if ($pending_exists) {
                $_SESSION['profile_flash_error'] = 'You already have a pending name/address request under review.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif ($first_name === '' || $last_name === '') {
                $_SESSION['profile_flash_error'] = 'First name and last name cannot be blank.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif ($missing) {
                $_SESSION['profile_flash_error'] = 'Please fill in: ' . implode(', ', $missing) . '.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif ($parts['postal_code'] !== '' && !preg_match('/^\d{4}$/', $parts['postal_code'])) {
                $_SESSION['profile_flash_error'] = 'A Philippine postal code is four digits.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif ($over = overlong_address_fields($parts)) {
                $_SESSION['profile_flash_error'] = 'These entries are too long: ' . implode(', ', $over) . '.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif ($over = overlong_address_fields($temp_parts, 'Temporary ')) {
                $_SESSION['profile_flash_error'] = 'These entries are too long: ' . implode(', ', $over) . '.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } elseif (!$name_changed && !$address_changed && !$temp_changed) {
                $_SESSION['profile_flash_error'] = 'Nothing has changed yet. Edit a name or address field before sending the request.';
                $_SESSION['profile_show_request_modal'] = true;
                header('Location: profile.php');
                exit;
            } else {
                $previous_address = (string)($resident['address'] ?? '');
                $request = $conn->prepare("INSERT INTO resident_update_requests
                        (resident_id, courtesy_title, first_name, middle_name, last_name, name_extension,
                         address, previous_address,
                         household_number, purok, street_highway, barangay, municipality, postal_code, province,
                         temporary_address, temp_household_number, temp_purok, temp_street_highway,
                         temp_barangay, temp_municipality, temp_postal_code, temp_province)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                // 1 integer + 22 strings
                $request->bind_param('i' . str_repeat('s', 22),
                    $resident_id, $courtesy_title, $first_name, $middle_name, $last_name, $name_extension,
                    $address, $previous_address,
                    $parts['household_number'], $parts['purok'], $parts['street_highway'],
                    $parts['barangay'], $parts['municipality'], $parts['postal_code'], $parts['province'],
                    $temporary_address,
                    $temp_parts['household_number'], $temp_parts['purok'], $temp_parts['street_highway'],
                    $temp_parts['barangay'], $temp_parts['municipality'], $temp_parts['postal_code'], $temp_parts['province']);
                $request->execute();
                $request->close();

                $_SESSION['profile_flash_message'] = 'Your name and address update request has been sent to staff for review.';
                header('Location: profile.php');
                exit;
            }
        }
    }
}

$resident_age = get_resident_age_label($resident['birthdate'] ?? null);
$current_gender = $resident['gender'] ?? '';

// Straight from the stored columns. No splitting, no guessing which comma
// belonged to which field.
$resident_address_fields = [];
foreach (address_field_names() as $field) {
    $resident_address_fields[$field] = (string)($resident[$field] ?? '');
}

$pending_request = false;
$pending_stmt = $conn->prepare("SELECT request_id FROM resident_update_requests WHERE resident_id = ? AND status = 'pending' LIMIT 1");
$pending_stmt->bind_param('i', $resident_id);
$pending_stmt->execute();
$pending_request = $pending_stmt->get_result()->fetch_assoc() !== null;
$pending_stmt->close();

if ($pending_request) {
    $error = '';
}


/* ============================================================================
   Family & household change requests.

   A resident may propose corrections to their own family details, but nothing
   is written to their record until staff or an administrator approve it. This
   mirrors the name and address request flow already in place, and is why the
   card renders a Request Change button rather than editable fields.

   Only one request may be open at a time: a queue of competing proposals for
   the same record would leave staff deciding which of them is current.
   ============================================================================ */
$family_error = '';
$family_saved = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['request_family_change'])) {
    $existing = $conn->prepare("SELECT 1 FROM resident_family_requests WHERE resident_id = ? AND status = 'pending'");
    $existing->bind_param('i', $resident_id);
    $existing->execute();
    $already_open = $existing->get_result()->num_rows > 0;
    $existing->close();

    $family_reason = trim($_POST['family_reason'] ?? '');

    $proposed = [
        'occupation'     => trim($_POST['occupation'] ?? ''),
        'hotline_number' => trim($_POST['hotline_number'] ?? ''),
        'is_married'     => ($_POST['is_married'] ?? '0') === '1' ? 1 : 0,
        'has_children'   => ($_POST['has_children'] ?? '0') === '1' ? 1 : 0,
    ];
    foreach (['spouse', 'father', 'mother'] as $who) {
        foreach (person_field_keys() as $field) {
            $proposed[$who . '_' . $field] = trim($_POST[$who . '_' . $field] ?? '');
        }
        // "Others" hands over to the box beside it.
        $proposed[$who . '_courtesy_title'] = resolve_courtesy_title(
            $proposed[$who . '_courtesy_title'],
            trim($_POST[$who . '_courtesy_title_other'] ?? '')
        );
    }
    if (!$proposed['is_married']) {
        foreach (person_field_keys() as $field) {
            $proposed['spouse_' . $field] = '';
        }
    }
    $proposed['children']   = $proposed['has_children'] ? collect_person_rows($_POST['children'] ?? []) : [];
    $proposed['references'] = collect_person_rows($_POST['references'] ?? []);

    $problems = array_merge(
        person_rows_errors($proposed['children'], 'Child'),
        person_rows_errors($proposed['references'], 'Character reference')
    );
    if ($family_reason === '') {
        $problems[] = 'Give a short reason so staff know what you are correcting.';
    }
    if ($proposed['is_married'] && $proposed['spouse_first_name'] === '') {
        $problems[] = 'Enter your spouse\'s first name, or answer No to "Are you married?".';
    }
    if (empty($proposed['references'])) {
        $problems[] = 'At least one character reference is required.';
    }
    if ($proposed['hotline_number'] !== '' && !preg_match('/' . hotline_number_pattern() . '/', $proposed['hotline_number'])) {
        $problems[] = 'Check the hotline number. ' . hotline_format_hint();
    }
    if ($already_open) {
        $problems[] = 'You already have a change waiting for review. Staff will look at that one first.';
    }

    if ($problems) {
        $family_error = $problems[0];
    } else {
        $payload = json_encode($proposed);
        $stmt = $conn->prepare("
            INSERT INTO resident_family_requests (resident_id, payload, reason, status)
            VALUES (?, ?, ?, 'pending')
        ");
        $stmt->bind_param('iss', $resident_id, $payload, $family_reason);
        $stmt->execute();
        $stmt->close();

        $_SESSION['flash_success'] = 'Your family details change was sent to barangay staff for review.';
        redirect('profile.php');
    }
}

// Anything already waiting, so the card can say so and the form can refuse a second.
$pending_family_request = null;
$stmt = $conn->prepare("
    SELECT request_id, requested_at FROM resident_family_requests
    WHERE resident_id = ? AND status = 'pending'
    ORDER BY requested_at DESC LIMIT 1
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$pending_family_request = $stmt->get_result()->fetch_assoc() ?: null;
$stmt->close();

require_once '../includes/header_resident.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>My Profile</h1>
        <p>Your personal details on record with the health center.</p>
    </div>
</div>

<?php if ($message && !$show_success_modal): ?><div class="alert alert-success alert-spaced"><?= h($message) ?></div><?php endif; ?>

<div class="grid-2">
    <div>
        <div class="card profile-card">
            <div class="card-head">
                <h2 class="card-head-title">Profile Overview</h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <!-- Same style as "Edit Contact" below, so both read as equal actions -->
                    <button type="button" class="btn" data-modal-open="request-change-modal">Request Change</button>
                </div>
            </div>

            <table class="table-spaced">
                <tr><th>Resident Number</th><td><?= h($resident['resident_number']) ?> <span class="muted-note">(cannot be changed)</span></td></tr>
                <tr><th>Courtesy Title</th><td><?= $resident['courtesy_title'] ? h($resident['courtesy_title']) : 'N/A' ?></td></tr>
                <tr><th>Full Name</th><td><?= h(with_courtesy_title($resident['courtesy_title'] ?? '', build_full_name($resident['first_name'], $resident['middle_name'] ?? '', $resident['last_name'], $resident['name_extension'] ?? ''))) ?></td></tr>
                <tr><th>First Name</th><td><?= h($resident['first_name']) ?></td></tr>
                <tr><th>Middle Name</th><td><?= $resident['middle_name'] ? h($resident['middle_name']) : 'N/A' ?></td></tr>
                <tr><th>Surname</th><td><?= h($resident['last_name']) ?></td></tr>
                <tr><th>Extension Name</th><td><?= $resident['name_extension'] ? h($resident['name_extension']) : 'N/A' ?></td></tr>
                <tr><th>Gender</th><td><?= h(gender_label($current_gender)) ?></td></tr>
            </table>
        </div>

        <div class="card">
            <div class="card-head">
                <h2 class="card-head-title">Personal Details</h2>
                <button type="button" class="btn" data-modal-open="request-birthdate-modal">Request Change</button>
            </div>

            <table class="table-spaced">
                <tr><th>Birthdate</th><td><?= $resident['birthdate']
                    ? h(date('F j, Y', strtotime($resident['birthdate'])))
                    : '<button type="button" class="link-cta" data-modal-open="request-birthdate-modal">Ask staff to add your birthdate</button>' ?></td></tr>
                <tr><th>Age</th><td><?= h($resident_age) ?></td></tr>
            </table>
        </div>

        <div class="card">
            <div class="card-head">
                <h2 class="card-head-title">Contact Information</h2>
                <button type="button" class="btn" data-modal-open="edit-contact-modal">Edit Contact</button>
            </div>

            <table class="table-spaced">
                <tr><th>Email</th><td><?= $resident['email']
                    ? h($resident['email'])
                    : '<button type="button" class="link-cta" data-modal-open="edit-contact-modal">Add your email</button>' ?></td></tr>
                <tr><th>Contact Number</th><td><?= $resident['contact_number']
                    ? h($resident['contact_number'])
                    : '<button type="button" class="link-cta" data-modal-open="edit-contact-modal">Add a contact number</button>' ?></td></tr>
                <tr><th>Complete Address</th><td><?= $resident['address'] ? h($resident['address']) : 'N/A' ?></td></tr>
            </table>

            <?php
            // The complete line above stays as the at-a-glance answer. The
            // breakdown below is what an address-change request edits, so
            // seeing the parts named makes it obvious which line to correct.
            ?>
            <h3 class="card-head-title">Address Breakdown</h3>
            <table class="table-spaced">
                <?php foreach (address_field_labels() as $field => $label): ?>
                <tr>
                    <th><?= h($label) ?></th>
                    <td><?= trim((string)($resident[$field] ?? '')) !== '' ? h($resident[$field]) : 'N/A' ?></td>
                </tr>
                <?php endforeach; ?>
            </table>

            <?php
            // A temporary resident has two addresses on file. Showing only the
            // permanent one would leave them unable to check where the health
            // center actually expects to find them.
            $is_temporary = ($resident['residency_status'] ?? 'permanent') === 'temporary';
            if ($is_temporary):
            ?>
            <h3 class="card-head-title">
                Temporary Address
                <?php if (!empty($resident['residence_type'])): ?>
                    <span class="muted-note">(<?= h(residence_type_label($resident['residence_type'])) ?>)</span>
                <?php endif; ?>
            </h3>
            <table class="table-spaced">
                <tr><th>Complete Address</th><td><?= $resident['temporary_address'] ? h($resident['temporary_address']) : 'N/A' ?></td></tr>
                <?php foreach (address_field_labels() as $field => $label): ?>
                <tr>
                    <th><?= h($label) ?></th>
                    <td><?= trim((string)($resident['temp_' . $field] ?? '')) !== '' ? h($resident['temp_' . $field]) : 'N/A' ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
            <?php endif; ?>
        </div>

        <?php
        /*
         * Family and household details.
         *
         * Read-only here. Everything on this card is recorded by staff when
         * the account is created, and corrections go through the same request
         * route as a name or address change rather than being edited straight
         * off the profile.
         */
        $profile_children   = fetch_person_rows($conn, 'resident_children', (int)$resident['resident_id']);
        $profile_references = fetch_person_rows($conn, 'resident_character_references', (int)$resident['resident_id']);

        /* Pull the spouse and parents into the same shape a child or a
           reference already arrives in, so one display helper covers all
           five kinds of person instead of three variants of the same code. */
        $person_from_columns = function ($prefix) use ($resident) {
            $parts = [];
            foreach (person_field_keys() as $field) {
                $parts[$field] = $resident[$prefix . '_' . $field] ?? '';
            }
            return $parts;
        };
        $spouse_parts = $person_from_columns('spouse');
        $father_parts = $person_from_columns('father');
        $mother_parts = $person_from_columns('mother');

        $is_married_on_file = (int)($resident['is_married'] ?? 0) === 1;
        ?>
        <div class="card">
            <div class="card-head">
                <h2 class="card-head-title">Family &amp; Household</h2>
                <?php // Residents ask; staff decide. Same rule as name and address. ?>
                <button type="button" class="btn" data-modal-open="family-request-modal">Request Change</button>
            </div>
            <p class="muted-note" style="margin-top:-4px;">
                <?php if ($pending_family_request): ?>
                    You have a change waiting for review. The details below are what is on file now.
                <?php else: ?>
                    Ask barangay staff to review any correction needed here.
                <?php endif; ?>
            </p>

            <?php if ($pending_family_request): ?>
            <div class="alert alert-info">
                Requested <?= h(date('M j, Y g:i A', strtotime($pending_family_request['requested_at']))) ?>.
                Nothing changes until staff approve it.
            </div>
            <?php endif; ?>

            <table class="table-spaced">
                <tr><th>Occupation</th><td><?= trim((string)($resident['occupation'] ?? '')) !== '' ? h($resident['occupation']) : 'N/A' ?></td></tr>
                <tr><th>Hotline Number</th><td><?= trim((string)($resident['hotline_number'] ?? '')) !== '' ? h($resident['hotline_number']) : 'N/A' ?></td></tr>
                <tr><th>Marital Status</th><td><?= $is_married_on_file ? 'Married' : 'Not married' ?></td></tr>
            </table>

            <?php
            /*
             * Each family member is shown the way Profile Overview shows the
             * resident: Courtesy Title, Full Name, First Name, Middle Name,
             * Surname, Extension Name and Gender, each on its own row. One
             * helper does it for all five kinds of person so a spouse and a
             * character reference cannot end up displayed differently.
             */
            $render_person_card = function ($heading, $parts) {
                $full = format_person_name($parts);
                ?>
                <h3 class="card-head-title"><?= h($heading) ?></h3>
                <?php if ($full === ''): ?>
                    <p class="muted-note">Not recorded.</p>
                <?php else: ?>
                <table class="table-spaced">
                    <tr><th>Courtesy Title</th><td><?= h(person_field_display('courtesy_title', $parts['courtesy_title'] ?? '')) ?></td></tr>
                    <tr><th>Full Name</th><td><?= h($full) ?></td></tr>
                    <tr><th>First Name</th><td><?= h(person_field_display('first_name', $parts['first_name'] ?? '')) ?></td></tr>
                    <tr><th>Middle Name</th><td><?= h(person_field_display('middle_name', $parts['middle_name'] ?? '')) ?></td></tr>
                    <tr><th>Surname</th><td><?= h(person_field_display('last_name', $parts['last_name'] ?? '')) ?></td></tr>
                    <tr><th>Extension Name</th><td><?= h(person_field_display('name_extension', $parts['name_extension'] ?? '')) ?></td></tr>
                    <tr><th>Gender</th><td><?= h(person_field_display('gender', $parts['gender'] ?? '')) ?></td></tr>
                </table>
                <?php endif;
            };

            if ($is_married_on_file) {
                $render_person_card('Spouse', $spouse_parts);
            }
            $render_person_card("Father", $father_parts);
            $render_person_card("Mother", $mother_parts);

            if (empty($profile_children)) {
                echo '<h3 class="card-head-title">Children</h3><p class="muted-note">None on record.</p>';
            } else {
                foreach ($profile_children as $child_index => $child_row) {
                    $render_person_card('Child ' . ($child_index + 1), $child_row);
                }
            }

            if (empty($profile_references)) {
                echo '<h3 class="card-head-title">Character References</h3>'
                   . '<p class="muted-note">None on record. Ask staff to add at least one.</p>';
            } else {
                foreach ($profile_references as $reference_index => $reference_row) {
                    $render_person_card('Character Reference ' . ($reference_index + 1), $reference_row);
                }
            }
            ?>
        </div>
    </div>

    <div class="card photo-card">
        <div class="card-head">
            <h2 class="card-head-title">Profile Photo</h2>
        </div>

        <?php if (!empty($resident['photo_path'])): ?>
            <img class="profile-photo-preview" src="<?= h('../' . $resident['photo_path']) ?>" alt="Resident Photo">
        <?php else: ?>
            <div class="photo-placeholder">No photo uploaded</div>
        <?php endif; ?>

        <div class="photo-card-actions">
            <label for="profile_photo" class="btn" id="select-profile-photo-btn">Upload Photo</label>
            <?php if (!empty($resident['photo_path'])): ?>
            <form method="POST" class="photo-remove-form">
                <input type="hidden" name="remove_photo" value="1">
                <button type="submit" class="btn btn-secondary"
                        data-confirm="Remove your profile photo? Your initial will be shown instead.">Remove Photo</button>
            </form>
            <?php endif; ?>
        </div>

        <form id="photo-upload-form" method="POST" enctype="multipart/form-data" class="profile-photo-form">
            <input type="file" id="profile_photo" name="profile_photo" accept="image/*">
            <input type="hidden" name="upload_photo" value="1">
        </form>
    </div>
</div>

<div class="modal-overlay" id="photo-confirm-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Confirm Profile Photo</h2>
        <p class="modal-text">Review the photo before uploading. If you want a different one, choose another.</p>
        <?php if ($upload_error): ?><div class="alert alert-error"><?= h($upload_error) ?></div><?php endif; ?>
        <div class="photo-cropper" id="photo-cropper">
            <canvas id="photo-crop-canvas" width="320" height="320" aria-label="Profile photo crop area"></canvas>
            <div class="photo-crop-guide" aria-hidden="true"></div>
        </div>
        <div class="photo-crop-controls">
            <label for="photo-zoom">Resize / Zoom</label>
            <div class="photo-zoom-row">
                <span aria-hidden="true">−</span>
                <input type="range" id="photo-zoom" min="1" max="3" step="0.01" value="1" aria-label="Resize profile photo">
                <span aria-hidden="true">+</span>
            </div>
            <p class="photo-crop-help">Drag the photo to reposition it. Use the slider to resize it inside the square.</p>
        </div>
        <div class="photo-preview-modal photo-final-preview">
            <span>Preview</span>
            <img id="photo-preview-image" src="" alt="Selected photo preview">
        </div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="photo-choose-another-btn">Choose another</button>
            <button type="button" class="btn" id="photo-confirm-btn">Confirm & Upload</button>
        </div>
    </div>
</div>

<!--
    Contact Information modal.
    data-keep-on-close is required here: this form is pre-filled with the
    resident's saved details, so the shared clear-on-open behaviour would
    blank every field the moment the modal is opened.
-->
<div class="modal-overlay<?= $show_contact_modal ? ' active' : '' ?>" id="edit-contact-modal" data-keep-on-close>
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Edit Contact Information</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
        <p class="muted-note">Email and contact number changes are saved immediately.</p>
        <form method="POST" class="profile-request-form" data-dirty-warn>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="e.g. juandelacruz@gmail.com" value="<?= h($_POST['email'] ?? $resident['email']) ?>">

            <label for="contact_number">Contact Number</label>
            <input type="tel" id="contact_number" name="contact_number" placeholder="e.g. 0917 123 4567"
                   pattern="<?= h(contact_number_pattern()) ?>" maxlength="20"
                   title="Digits, spaces, +, - and brackets only" value="<?= h($_POST['contact_number'] ?? $resident['contact_number']) ?>">
            <button type="submit" name="action" value="save_contact" class="btn">Save Email & Contact</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
        </form>
    </div>
</div>

<!--
    Request change modal.
    data-keep-on-close is required here: this form is pre-filled with the
    resident's saved details, so the shared clear-on-open behaviour would
    blank every field the moment the modal is opened.
-->
<div class="modal-overlay<?= $show_request_modal ? ' active' : '' ?>" id="request-change-modal" data-keep-on-close data-pending-request="<?= $pending_request ? '1' : '0' ?>">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Request Name / Address Change</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
        <p class="muted-note">Address changes are sent to staff for review.</p>
        <form method="POST" class="profile-request-form" data-dirty-warn>
            <div class="grid-2">
                <div>
                    <label for="courtesy_title">Courtesy Title</label>
                    <select id="courtesy_title" name="courtesy_title" data-title-select>
                        <option value="">None</option>
                        <?php
                        $stored_title = (string)($_POST['courtesy_title'] ?? ($resident['courtesy_title'] ?? ''));
                        $known_title = in_array($stored_title, courtesy_titles(), true);
                        foreach (courtesy_titles() as $title): ?>
                        <option value="<?= h($title) ?>" <?= $stored_title === $title ? 'selected' : '' ?>><?= h($title) ?></option>
                        <?php endforeach; ?>
                        <option value="Others" <?= ($stored_title !== '' && !$known_title) ? 'selected' : '' ?>>Others</option>
                    </select>
                </div>
                <div data-title-other hidden>
                    <label for="courtesy_title_other">Specify Title</label>
                    <input type="text" id="courtesy_title_other" name="courtesy_title_other" maxlength="20"
                           placeholder="Dr., Engr., Atty."
                           value="<?= h($_POST['courtesy_title_other'] ?? ($known_title ? '' : $stored_title)) ?>">
                </div>
                <div>
                    <label for="first_name">First Name</label>
                    <input type="text" id="first_name" name="first_name" placeholder="e.g. Juan" value="<?= h($_POST['first_name'] ?? $resident['first_name']) ?>">
                </div>
                <div>
                    <label for="middle_name">Middle Name</label>
                    <input type="text" id="middle_name" name="middle_name" placeholder="e.g. Santos" value="<?= h($_POST['middle_name'] ?? ($resident['middle_name'] ?? '')) ?>">
                </div>
                <div>
                    <label for="last_name">Surname</label>
                    <input type="text" id="last_name" name="last_name" placeholder="e.g. Dela Cruz" value="<?= h($_POST['last_name'] ?? $resident['last_name']) ?>">
                </div>
                <div>
                    <label for="name_extension">Extension Name</label>
                    <input type="text" id="name_extension" name="name_extension" placeholder="Jr., Sr., III"
                           value="<?= h($_POST['name_extension'] ?? ($resident['name_extension'] ?? '')) ?>">
                </div>
            </div>

            <div class="grid-2">
                <?php foreach (address_field_labels() as $field => $label):
                    $required = in_array($field, required_address_fields(), true);
                ?>
                <div>
                    <label for="<?= h($field) ?>"><?= h($label) ?><?= $required ? ' <span class="req">*</span>' : '' ?></label>
                    <input type="text" id="<?= h($field) ?>" name="<?= h($field) ?>"
                           placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                           maxlength="<?= (int)address_field_maxlength($field) ?>"
                           <?= $field === 'postal_code' ? 'inputmode="numeric"' : '' ?>
                           value="<?= h($_POST[$field] ?? $resident_address_fields[$field]) ?>">
                </div>
                <?php endforeach; ?>
            </div>

            <?php if (($resident['residency_status'] ?? 'permanent') === 'temporary'): ?>
            <?php // Where the resident is actually staying. Reviewed the same way. ?>
            <h3 class="form-section-title">Temporary Address</h3>
            <p class="field-hint">This is the address the health center uses to find you. Corrections are reviewed by staff.</p>
            <div class="grid-2">
                <?php foreach (address_field_labels() as $field => $label): ?>
                <div>
                    <label for="temp_<?= h($field) ?>"><?= h($label) ?></label>
                    <input type="text" id="temp_<?= h($field) ?>" name="temp_<?= h($field) ?>"
                           placeholder="<?= h(address_field_placeholders()[$field] ?? '') ?>"
                           maxlength="<?= (int)address_field_maxlength($field) ?>"
                           <?= $field === 'postal_code' ? 'inputmode="numeric"' : '' ?>
                           value="<?= h($_POST['temp_' . $field] ?? ($resident['temp_' . $field] ?? '')) ?>">
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <button type="submit" name="action" value="request_name_address" class="btn">Request Name/Address Change</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
        </form>
    </div>
</div>

<!--
    Birthdate correction modal.
    data-keep-on-close is required here: the field is pre-filled with the
    stored birthdate, and the shared clear-on-open behaviour would blank it.
-->
<div class="modal-overlay<?= $show_birthdate_modal ? ' active' : '' ?>" id="request-birthdate-modal" data-keep-on-close>
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Request Birthdate Correction</h2>
        <?php if ($error && $show_birthdate_modal): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
        <p class="muted-note">
            Your birthdate sets the age on your record and your senior-citizen
            eligibility, so a correction is reviewed by staff before it takes effect.
        </p>
        <form method="POST" class="profile-request-form" data-dirty-warn>
            <label for="birthdate">Corrected Birthdate</label>
            <input type="date" id="birthdate" name="birthdate" max="<?= date('Y-m-d') ?>"
                   value="<?= h($_POST['birthdate'] ?? ($resident['birthdate'] ?? '')) ?>">
            <small class="field-hint">Currently on record: <?= $resident['birthdate'] ? h($resident['birthdate']) : 'not set' ?>.</small>

            <button type="submit" name="action" value="request_birthdate" class="btn">Send Request</button>
            <button type="button" class="btn-secondary" data-modal-close>Cancel</button>
        </form>
    </div>
</div>

<script>
// "Others" hands the courtesy title to a free-text box.
(function () {
    var select = document.querySelector('[data-title-select]');
    var other = document.querySelector('[data-title-other]');
    if (!select || !other) { return; }

    function sync() {
        var custom = select.value === 'Others';
        other.hidden = !custom;
        var input = other.querySelector('input');
        if (input) { input.required = custom; }
    }
    select.addEventListener('change', sync);
    sync();
})();
</script>

<!-- Successful update confirmation modal -->
<div class="modal-overlay<?= $show_success_modal ? ' active' : '' ?>" id="profile-success-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Profile Updated</h2>
        <p class="modal-text"><?= h($message) ?></p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>

<?php /* ---------- Request a change to family & household details ---------- */ ?>
<div class="modal-overlay<?= $family_error !== '' ? ' active' : '' ?>" id="family-request-modal">
    <div class="modal-box modal-wide">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2>Request Family &amp; Household Change</h2>
        <p class="muted-note">
            Correct anything below and send it to barangay staff. Nothing on your record
            changes until they approve it.
        </p>

        <?php if ($family_error !== ''): ?>
        <div class="alert alert-error"><?= h($family_error) ?></div>
        <?php endif; ?>

        <?php if ($pending_family_request): ?>
        <div class="alert alert-info">
            You already have a change waiting for review, requested
            <?= h(date('M j, Y g:i A', strtotime($pending_family_request['requested_at']))) ?>.
            Staff will look at that one first.
        </div>
        <?php else: ?>
        <form method="POST" data-unsaved-warning>
            <input type="hidden" name="request_family_change" value="1">

            <?php
            /* The same partial the Add Resident form uses, so a resident is
               offered exactly the fields staff record — one definition, no
               chance of the two drifting apart. */
            $ff_prefix = 'req';
            $ff_values = [
                'occupation'     => $_POST['occupation']     ?? ($resident['occupation'] ?? ''),
                'hotline_number' => $_POST['hotline_number'] ?? ($resident['hotline_number'] ?? ''),
                'is_married'     => $_POST['is_married']     ?? (string)(int)($resident['is_married'] ?? 0),
                'has_children'   => $_POST['has_children']   ?? (string)(int)($resident['has_children'] ?? 0),
                'children'       => isset($_POST['children'])   ? collect_person_rows($_POST['children'])   : $profile_children,
                'references'     => isset($_POST['references']) ? collect_person_rows($_POST['references']) : $profile_references,
            ];
            foreach (['spouse', 'father', 'mother'] as $ff_who) {
                foreach (person_field_keys() as $ff_field) {
                    $ff_key = $ff_who . '_' . $ff_field;
                    $ff_values[$ff_key] = $_POST[$ff_key] ?? ($resident[$ff_key] ?? '');
                }
            }
            require __DIR__ . '/../includes/family_fields.php';
            ?>

            <div style="margin-top:14px;">
                <label for="family_reason">Reason for the change <span class="req">*</span></label>
                <input type="text" id="family_reason" name="family_reason" required maxlength="255"
                       placeholder="e.g. My spouse's surname was spelled incorrectly"
                       value="<?= h($_POST['family_reason'] ?? '') ?>">
                <small class="field-hint">Staff read this when deciding, so keep it specific.</small>
            </div>

            <div class="modal-actions">
                <button type="submit">Send Request</button>
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            </div>
        </form>
        <?php endif; ?>
    </div>
</div>

<?php require_once '../includes/footer.php'; ?>