<?php
/**
 * The staff member's own half of their record.
 *
 * An administrator creates the employment record (Staff Number, date hired,
 * role). Everything else here belongs to the staff member, so they enter it
 * themselves rather than dictating it to an administrator.
 *
 * Two things are deliberately not self-service:
 *   - Name and role are employment record changes; an administrator makes them.
 *   - The permanent address is on file for employment purposes, so a change
 *     after onboarding is submitted as a request and waits for review. The
 *     first entry, made during onboarding, writes straight through — a new
 *     hire cannot be made to wait for approval before finishing setup.
 *
 * The administrator's own view is the employment record and photo only. An
 * administrator has no onboarding step and no address on file to maintain.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'My Profile';
$asset_path = '../';
$error = '';
$upload_error = '';
$show_upload_modal = false;

$staff_id = (int)$_SESSION['staff_id'];
$is_admin = staff_is_admin();

$stmt = $conn->prepare("SELECT staff_number, username, full_name, courtesy_title, date_hired, role,
                               contact_number, email, birthdate, gender, license_number, address, emergency_contact,
                               emergency_contact_name, emergency_contact_number,
                               photo_path, household_number, purok, street_highway,
                               barangay, municipality, postal_code, province,
                               is_first_login, profile_completed
                        FROM staff WHERE staff_id = ?");
$stmt->bind_param('i', $staff_id);
$stmt->execute();
$account = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$account) {
    redirect('logout.php');
}

$onboarding = !$is_admin && (int)($account['profile_completed'] ?? 1) === 0;
$saved = get_flash('profile_saved');

// A change already waiting on the administrator. While one is open the
// address form is read-only: a second request would just give them the same
// decision twice with different answers.
$pending_request = null;
if (!$is_admin) {
    $stmt = $conn->prepare("SELECT * FROM staff_update_requests WHERE staff_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1");
    $stmt->bind_param('i', $staff_id);
    $stmt->execute();
    $pending_request = $stmt->get_result()->fetch_assoc();
    $stmt->close();
}

/* ------------------------------------------------------------
   Profile photo upload
   ------------------------------------------------------------ */
/**
 * Discard the photo and fall back to the initial-letter avatar.
 *
 * The file is deleted from disk as well as cleared from the record: a
 * profile photo the user has removed should not stay recoverable by URL.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['remove_photo'])) {
    if (!empty($account['photo_path'])) {
        $old_file = __DIR__ . '/../' . $account['photo_path'];
        if (is_file($old_file)) {
            @unlink($old_file);
        }
    }
    $stmt = $conn->prepare('UPDATE staff SET photo_path = NULL WHERE staff_id = ?');
    $stmt->bind_param('i', $staff_id);
    $stmt->execute();
    $stmt->close();

    $account['photo_path'] = null;
    $_SESSION['staff_photo'] = null;
    $_SESSION['flash_success'] = 'Profile photo removed. Your initial is shown instead.';
    redirect('complete_profile.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['upload_photo'])) {
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
        // getimagesize() reads the actual header, so a renamed .php cannot
        // pass on its extension alone.
        $file_info = getimagesize($file_tmp);
        $allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        $file_ext = strtolower(pathinfo(basename($file['name']), PATHINFO_EXTENSION));

        if ($file_info === false) {
            $upload_error = 'Uploaded file must be a valid image.';
        } elseif (!in_array($file_ext, $allowed_extensions, true)) {
            $upload_error = 'Only JPG, PNG, GIF, or WEBP images are allowed.';
        } elseif ($file['size'] > 5 * 1024 * 1024) {
            $upload_error = 'Please choose a photo under 5 MB.';
        } else {
            $upload_dir = __DIR__ . '/../uploads/staff';
            if (!is_dir($upload_dir) && !mkdir($upload_dir, 0755, true)) {
                $upload_error = 'Unable to create the upload directory. Please contact the administrator.';
            } else {
                $unique_name = 'staff_' . $staff_id . '_' . time() . '.' . $file_ext;
                $destination = $upload_dir . '/' . $unique_name;

                if (!move_uploaded_file($file_tmp, $destination)) {
                    $upload_error = 'Unable to save the uploaded photo. Please try again.';
                } else {
                    // Remove the previous file so the folder does not collect
                    // an image for every change the staff member makes.
                    if (!empty($account['photo_path'])) {
                        $old = __DIR__ . '/../' . $account['photo_path'];
                        if (is_file($old)) {
                            @unlink($old);
                        }
                    }

                    $photo_path = 'uploads/staff/' . $unique_name;
                    $stmt = $conn->prepare('UPDATE staff SET photo_path = ? WHERE staff_id = ?');
                    $stmt->bind_param('si', $photo_path, $staff_id);
                    $stmt->execute();
                    $stmt->close();

                    set_flash('profile_saved', 'photo');
                    redirect('complete_profile.php');
                }
            }
        }
    }
}

/* ------------------------------------------------------------
   Personal details and permanent address  (Staff only)
   ------------------------------------------------------------ */
if (!$is_admin && $_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['upload_photo'])) {
    $contact_number    = trim($_POST['contact_number'] ?? '');
    $email             = trim($_POST['email'] ?? '');
    $birthdate         = trim($_POST['birthdate'] ?? '');
    $gender            = trim($_POST['gender'] ?? '');
    $license_number    = trim($_POST['license_number'] ?? '');
    $emergency_contact_name   = trim($_POST['emergency_contact_name'] ?? '');
    $emergency_contact_number = trim($_POST['emergency_contact_number'] ?? '');
    // The old single-line column is kept in step so anything still reading it
    // does not go blank.
    $emergency_contact = trim($emergency_contact_name . ($emergency_contact_number !== '' ? ' - ' . $emergency_contact_number : ''));

    $household_number    = trim($_POST['household_number'] ?? '');
    $purok        = trim($_POST['purok'] ?? '');
    $street_highway = trim($_POST['street_highway'] ?? '');
    $barangay            = trim($_POST['barangay'] ?? '');
    $municipality        = trim($_POST['municipality'] ?? '');
    $postal_code         = trim($_POST['postal_code'] ?? '');
    $province            = trim($_POST['province'] ?? '');
    $reason              = trim($_POST['reason'] ?? '');

    $gender = array_key_exists($gender, gender_options()) ? $gender : '';
    $birthdate_value = $birthdate !== '' ? $birthdate : null;

    // Optional, so an empty box is stored as NULL rather than an empty
    // string — that way "no licence" and "not filled in yet" read the same
    // in the database instead of being two different kinds of nothing.
    $license_number_value = $license_number !== '' ? $license_number : null;

    $new_address = build_address_line(
        $household_number, $purok, $street_highway,
        $barangay, $municipality, $postal_code, $province
    );

    // After onboarding the address is under review, so the form no longer
    // sends it. Keep what is on file rather than reading blanks back in.
    $address_locked = !$onboarding && $pending_request !== null;
    $address_changed = !$onboarding && !$address_locked && $new_address !== (string)$account['address'];

    if ($contact_number === '') {
        $error = 'Contact number is required.';
    } elseif (!preg_match('/^[0-9+()\-\s]{7,20}$/', $contact_number)) {
        $error = 'Enter a contact number using digits, spaces, and + ( ) - only.';
    } elseif ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Enter a valid email address, or leave the field blank.';
    } elseif ($birthdate !== '' && $birthdate >= date('Y-m-d')) {
        $error = 'Birthdate must be in the past.';
    } elseif ($license_number !== '' && mb_strlen($license_number) > 50) {
        $error = 'That license number is too long (50 characters maximum).';
    } elseif ($license_number !== '' && !preg_match('/^[A-Za-z0-9\-\s\/]+$/', $license_number)) {
        $error = 'Enter a license number using letters, digits, spaces, and - / only.';
    } elseif ($emergency_contact_number !== '' && !preg_match('/^[0-9+()\-\s]{7,20}$/', $emergency_contact_number)) {
        $error = 'Enter an emergency contact number using digits, spaces, and + ( ) - only.';
    } elseif (!$address_locked && ($household_number === '' || $barangay === '' || $municipality === '' || $province === '')) {
        $error = 'Household Number, Barangay, Municipality/City, and Province are required.';
    } elseif (!$address_locked && $postal_code !== '' && !preg_match('/^\d{4}$/', $postal_code)) {
        $error = 'A Philippine postal code is four digits.';
    } elseif ($address_changed && $reason === '') {
        $error = 'Give a short reason for the address change so the administrator can act on it.';
    } else {
        $conn->begin_transaction();

        // Contact details are the staff member's own and save immediately.
        $stmt = $conn->prepare(
            "UPDATE staff
                SET contact_number = ?, email = ?, birthdate = ?, gender = ?, license_number = ?,
                    emergency_contact = ?, emergency_contact_name = ?, emergency_contact_number = ?,
                    profile_completed = 1
              WHERE staff_id = ?"
        );
        $stmt->bind_param('ssssssssi', $contact_number, $email, $birthdate_value, $gender, $license_number_value,
            $emergency_contact, $emergency_contact_name, $emergency_contact_number, $staff_id);
        $stmt->execute();
        $stmt->close();

        if ($onboarding) {
            // First time through: the address is being recorded, not changed.
            $stmt = $conn->prepare(
                "UPDATE staff
                    SET address = ?, household_number = ?, purok = ?, street_highway = ?,
                        barangay = ?, municipality = ?, postal_code = ?, province = ?
                  WHERE staff_id = ?"
            );
            $stmt->bind_param(
                'ssssssssi',
                $new_address, $household_number, $purok, $street_highway,
                $barangay, $municipality, $postal_code, $province, $staff_id
            );
            $stmt->execute();
            $stmt->close();

            $outcome = 'first';
        } elseif ($address_changed) {
            // Every later change is reviewed. Nothing on the staff row moves
            // until an administrator approves it.
            $stmt = $conn->prepare(
                "INSERT INTO staff_update_requests
                    (staff_id, staff_number, staff_name, household_number, purok, street_highway,
                     barangay, municipality, postal_code, province, address, previous_address, reason)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->bind_param(
                'issssssssssss',
                $staff_id, $account['staff_number'], $account['full_name'],
                $household_number, $purok, $street_highway,
                $barangay, $municipality, $postal_code, $province,
                $new_address, $account['address'], $reason
            );
            $stmt->execute();
            $stmt->close();

            $outcome = 'requested';
        } else {
            $outcome = 'normal';
        }

        $conn->commit();
        set_flash('profile_saved', $outcome);
        redirect('complete_profile.php');
    }
}

// Re-show submitted values after a validation error so nothing is retyped.
$value = function ($field) use ($account) {
    return $_SERVER['REQUEST_METHOD'] === 'POST'
        ? ($_POST[$field] ?? '')
        : ($account[$field] ?? '');
};

// During onboarding there is nowhere else to go until this is done.
$hide_navbar = $onboarding && !$saved;

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1><?= $onboarding ? 'Complete Your Profile' : 'My Profile' ?></h1>
        <p><?= $onboarding
            ? 'Step 2 of 2. Tell the health center how to reach you.'
            : ($is_admin ? 'Your account record.' : 'Keep your contact details up to date.') ?></p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

<div class="grid-2">

    <!-- ============ Account record (Admin Record / Staff Record) ============ -->
    <div class="card">
        <div class="card-head">
            <h2 class="card-head-title"><?= $is_admin ? 'Admin Record' : 'Staff Record' ?></h2>
        </div>

        <?php if ($onboarding): ?>
        <div class="alert alert-info">
            Your name and role are set by the administrator. Everything below the
            photo is yours to enter and yours to change later.
        </div>
        <?php endif; ?>

        <dl class="credential-slip">
            <dt>Staff Number</dt><dd><?= h($account['staff_number'] ?? 'N/A') ?></dd>
            <dt>Username</dt><dd><?= h($account['username']) ?></dd>
            <dt>Full name</dt><dd><?= h(with_courtesy_title($account['courtesy_title'] ?? '', $account['full_name'])) ?></dd>
            <dt>Date hired</dt><dd><?= $account['date_hired'] ? h($account['date_hired']) : 'N/A' ?></dd>
            <dt>Role</dt><dd><?= h(ucfirst($account['role'])) ?></dd>
        </dl>

        <p class="field-hint">Need a new password? <a href="change_password.php">Change your password</a>.</p>
    </div>

    <!-- ============ Profile photo (own section, as on the resident profile) ============ -->
    <div class="card photo-card">
        <div class="card-head">
            <h2 class="card-head-title">Profile Photo</h2>
        </div>

        <?php if (!empty($account['photo_path'])): ?>
            <img class="profile-photo-preview" src="<?= h('../' . $account['photo_path']) ?>?v=<?= time() ?>" alt="Profile photo">
        <?php else: ?>
            <div class="photo-placeholder">No photo uploaded</div>
        <?php endif; ?>

        <div class="photo-card-actions">
            <label for="profile_photo" class="btn" id="select-profile-photo-btn">Upload Photo</label>
            <?php if (!empty($account['photo_path'])): ?>
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

<?php if (!$is_admin): ?>
<div class="card card-form">
    <form method="POST">
        <h3 class="card-head-title">Your details</h3>

        <div class="grid-2">
            <div>
                <label for="contact_number">Contact Number <span class="req">*</span></label>
                <input type="text" id="contact_number" name="contact_number" required
                       placeholder="09XX XXX XXXX" value="<?= h($value('contact_number')) ?>">
            </div>
            <div>
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" value="<?= h($value('email')) ?>"
                    placeholder="e.g. juandelacruz@gmail.com">
            </div>
            <div>
                <label for="birthdate">Birthdate</label>
                <input type="date" id="birthdate" name="birthdate" max="<?= date('Y-m-d') ?>" value="<?= h($value('birthdate')) ?>">
            </div>
            <div>
                <label for="age_display">Age</label>
                <?php
                /*
                 * Filled in from the birthdate and never submitted.
                 *
                 * Storing an age would mean storing something that is wrong
                 * from the next birthday onwards, so it is worked out from
                 * the date every time it is shown. The server renders the
                 * opening value so it is right before any script runs.
                 */
                $age_now = calculate_age_from_birthdate($value('birthdate'));
                ?>
                <input type="text" id="age_display" class="field-readonly" readonly tabindex="-1"
                       placeholder="Select a birthdate"
                       value="<?= $age_now === null ? '' : h($age_now === 1 ? '1 year old' : $age_now . ' years old') ?>">
                <small class="field-hint">Worked out from your birthdate.</small>
            </div>
            <div>
                <label for="gender">Gender</label>
                <select id="gender" name="gender">
                    <option value="">Select</option>
                    <?php foreach (gender_options() as $gender_value => $gender_text): ?>
                    <option value="<?= h($gender_value) ?>" <?= $value('gender') === $gender_value ? 'selected' : '' ?>><?= h($gender_text) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label for="license_number">License Number</label>
                <input type="text" id="license_number" name="license_number" maxlength="50"
                       placeholder="PRC or CSE number, if you have one"
                       value="<?= h($value('license_number')) ?>">
                <small class="field-hint">Optional. Leave this blank if it does not apply to you.</small>
            </div>
        </div>

        <h3 class="card-head-title">Permanent address</h3>

        <?php if ($pending_request): ?>
            <!-- A request is open. Show what was asked for and lock the fields
                 rather than letting a second, conflicting request be raised. -->
            <div class="alert alert-info">
                <strong>Change awaiting the administrator.</strong><br>
                You asked to change this to: <?= h($pending_request['address']) ?><br>
                Submitted <?= h($pending_request['submitted_at']) ?>. Your address on file stays
                as it is until the request is reviewed.
            </div>

            <dl class="credential-slip">
                <dt>Address on file</dt><dd><?= $account['address'] ? h($account['address']) : 'N/A' ?></dd>
            </dl>
        <?php else: ?>
            <p class="form-note">
                <?= $onboarding
                    ? 'Entered in parts so a later correction can name the one line that changed.'
                    : 'Changing any part of this sends a request to the administrator. Your address on file stays as it is until they approve it.' ?>
            </p>

            <div class="grid-2">
                <div>
                    <label for="household_number">Household Number <span class="req">*</span></label>
                    <input type="text" id="household_number" name="household_number" required
                           placeholder="0444" value="<?= h($value('household_number')) ?>">
                </div>
                <div>
                    <label for="purok">Purok</label>
                    <input type="text" id="purok" name="purok"
                           placeholder="Purok 3" value="<?= h($value('purok')) ?>">
                </div>
                <div>
                    <label for="street_highway">Street / Highway / Subdivision / Village</label>
                    <input type="text" id="street_highway" name="street_highway"
                           placeholder="Rizal Street" value="<?= h($value('street_highway')) ?>">
                </div>
                <div>
                    <label for="barangay">Barangay <span class="req">*</span></label>
                    <input type="text" id="barangay" name="barangay" required
                           placeholder="Sapang Puke" value="<?= h($value('barangay')) ?>">
                </div>
                <div>
                    <label for="municipality">Municipality / City <span class="req">*</span></label>
                    <input type="text" id="municipality" name="municipality" required
                           placeholder="Malolos" value="<?= h($value('municipality')) ?>">
                </div>
                <div>
                    <label for="postal_code">Postal Code</label>
                    <input type="text" id="postal_code" name="postal_code" inputmode="numeric" maxlength="4"
                           placeholder="3000" value="<?= h($value('postal_code')) ?>">
                </div>
                <div>
                    <label for="province">Province <span class="req">*</span></label>
                    <input type="text" id="province" name="province" required
                           placeholder="Bulacan" value="<?= h($value('province')) ?>">
                </div>
            </div>

            <?php if (!$onboarding): ?>
            <label for="reason">Reason for the address change</label>
            <input type="text" id="reason" name="reason" maxlength="255"
                   placeholder="Moved to a new household, corrected a misspelling" value="<?= h($_POST['reason'] ?? '') ?>">
            <small class="field-hint">Only needed if you actually change the address. The administrator sees this.</small>
            <?php endif; ?>
        <?php endif; ?>

        <h3 class="card-head-title">Emergency contact</h3>
        <div class="grid-2">
            <div>
                <label for="emergency_contact_name">Contact Name</label>
                <input type="text" id="emergency_contact_name" name="emergency_contact_name" maxlength="100"
                       placeholder="Who should we call?" value="<?= h($value('emergency_contact_name')) ?>">
            </div>
            <div>
                <label for="emergency_contact_number">Contact Number</label>
                <input type="text" id="emergency_contact_number" name="emergency_contact_number" maxlength="20"
                       placeholder="09XX XXX XXXX" value="<?= h($value('emergency_contact_number')) ?>">
            </div>
        </div>

        <button type="submit" class="btn-wide"><?= $onboarding ? 'Finish Setup' : 'Save Changes' ?></button>
    </form>
</div>
<?php endif; ?>

<!-- Photo crop and confirm. Shares the markup and IDs the resident profile
     uses, so the cropper in assets/js/script.js drives it unchanged. -->
<div class="modal-overlay<?= $show_upload_modal ? ' active' : '' ?>" id="photo-confirm-modal">
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
                <span aria-hidden="true">&minus;</span>
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
            <button type="button" class="btn" id="photo-confirm-btn">Confirm &amp; Upload</button>
        </div>
    </div>
</div>

<!-- Saved confirmation -->
<div class="modal-overlay<?= $saved ? ' active' : '' ?>" id="profile-success-modal" data-keep-on-close>
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>
            <?php if ($saved === 'first'): ?>You are all set
            <?php elseif ($saved === 'photo'): ?>Photo Updated
            <?php elseif ($saved === 'requested'): ?>Request Sent
            <?php else: ?>Profile Saved<?php endif; ?>
        </h2>
        <p class="modal-text">
            <?php if ($saved === 'first'): ?>
                Your account is ready. You now have full access to the staff portal.
            <?php elseif ($saved === 'photo'): ?>
                Your profile photo has been updated.
            <?php elseif ($saved === 'requested'): ?>
                Your contact details were saved. The address change was sent to the
                administrator for review &mdash; your address on file is unchanged until
                they approve it.
            <?php else: ?>
                Your details have been updated.
            <?php endif; ?>
        </p>
        <div class="modal-actions">
            <a class="btn" href="dashboard.php">Go to Dashboard</a>
            <button type="button" class="btn btn-secondary" data-modal-close>Stay Here</button>
        </div>
    </div>
</div>

<script>
/*
 * Keep the read-only Age box in step with the birthdate.
 *
 * Age is shown, never submitted: it is derived from the date each time so it
 * cannot drift out of date in the database the way a stored number would.
 * The server prints the opening value, so the field is already correct if
 * this script never runs.
 */
(function () {
    var birthdate = document.getElementById('birthdate');
    var ageField = document.getElementById('age_display');
    if (!birthdate || !ageField) { return; }

    function describeAge(value) {
        if (!value) { return ''; }

        var parts = value.split('-');
        if (parts.length !== 3) { return ''; }

        var born = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(born.getTime())) { return ''; }

        var today = new Date();
        if (born > today) { return 'Invalid birthdate'; }

        var age = today.getFullYear() - born.getFullYear();
        var monthDiff = today.getMonth() - born.getMonth();

        // This year's birthday has not come round yet.
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
            age = age - 1;
        }

        if (age < 0) { return 'Invalid birthdate'; }
        return age === 1 ? '1 year old' : age + ' years old';
    }

    function sync() {
        ageField.value = describeAge(birthdate.value);
    }

    birthdate.addEventListener('change', sync);
    birthdate.addEventListener('input', sync);
    sync();
})();
</script>

<?php require_once '../includes/footer.php'; ?>
