<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'User Management';
$asset_path = '../';
$error = '';
$form_had_error = false;

// Admins manage staff AND residents. Staff manage residents only.
$is_admin = staff_is_admin();
$me = (int)$_SESSION['staff_id'];

$message = get_flash('success');
// Credentials for a just-created account, handed over once and never stored.
$new_account = get_flash('new_staff');
$new_account = $new_account ? json_decode($new_account, true) : null;

/* ------------------------------------------------------------
   Activate / deactivate a STAFF account  (Admin only)
   ------------------------------------------------------------ */
if (isset($_GET['toggle_staff'])) {
    $id = (int)$_GET['toggle_staff'];

    if (!$is_admin) {
        // Server-side guard: hiding the button is not access control
        $error = 'Only administrators can deactivate staff accounts.';
    } elseif ($id === $me) {
        $error = 'You cannot deactivate your own account while logged in.';
    } else {
        $stmt = $conn->prepare("SELECT is_active FROM staff WHERE staff_id = ? AND deleted_at IS NULL");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($row) {
            $new_state = ((int)$row['is_active'] === 1) ? 0 : 1;
            $stmt = $conn->prepare("UPDATE staff SET is_active = ? WHERE staff_id = ?");
            $stmt->bind_param('ii', $new_state, $id);
            $stmt->execute();
            $stmt->close();

            set_flash('success', $new_state ? 'Staff account reactivated.' : 'Staff account deactivated.');
            redirect('user_management.php');
        }
    }
}

/* ------------------------------------------------------------
   Delete a STAFF account  (Admin only)

   Archives rather than removes. The account leaves every listing and
   can no longer sign in, but it lands in Deleted Accounts where an
   administrator can restore it. Nothing on this page destroys a record.
   ------------------------------------------------------------ */
if (isset($_GET['delete_staff'])) {
    $id = (int)$_GET['delete_staff'];

    if (!$is_admin) {
        $error = 'Only administrators can delete a staff account.';
    } elseif ($id === $me) {
        $error = 'You cannot delete the account you are signed in with.';
    } else {
        $stmt = $conn->prepare("SELECT full_name, role FROM staff WHERE staff_id = ? AND deleted_at IS NULL");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $target = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$target) {
            $error = 'That staff account could not be found.';
        } elseif (strtolower(trim($target['role'])) === 'admin' && active_admin_count($conn, $id) === 0) {
            // Deleting the last administrator would leave nobody able to
            // restore it — the archive would be unreachable.
            $error = 'This is the only administrator account left. Promote or create another administrator before deleting this one.';
        } else {
            archive_account($conn, 'staff', $id, $me, $_SESSION['staff_name'] ?? '',
                            'Deleted from User Management.');
            set_flash('success', $target['full_name'] . ' was moved to Deleted Accounts. You can restore the account from there.');
            redirect('user_management.php');
        }
    }
}

/* ------------------------------------------------------------
   Reset a STAFF password back to their Staff Number  (Admin only)

   Sends the account back through onboarding: the next login lands on
   Change Password before anything else.
   ------------------------------------------------------------ */
if (isset($_GET['reset_staff'])) {
    $id = (int)$_GET['reset_staff'];

    if (!$is_admin) {
        $error = 'Only administrators can reset a staff password.';
    } elseif ($id === $me) {
        $error = 'Use Change Password to update your own password.';
    } else {
        $stmt = $conn->prepare("SELECT staff_number FROM staff WHERE staff_id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($row && $row['staff_number']) {
            $hash = password_hash($row['staff_number'], PASSWORD_DEFAULT);
            $stmt = $conn->prepare("UPDATE staff SET password = ?, is_first_login = 1 WHERE staff_id = ?");
            $stmt->bind_param('si', $hash, $id);
            $stmt->execute();
            $stmt->close();

            set_flash('success', 'Password reset to the Staff Number (' . $row['staff_number'] . '). They will be asked to set a new one at their next login.');
            redirect('user_management.php');
        }
        $error = 'That staff account could not be found.';
    }
}

/* ------------------------------------------------------------
   Activate / deactivate a RESIDENT account  (Staff and Admin)

   This is the action staff reach for instead of deletion: it is
   reversible and keeps the resident's survey history intact.
   ------------------------------------------------------------ */
if (isset($_GET['toggle_resident'])) {
    $id = (int)$_GET['toggle_resident'];

    $stmt = $conn->prepare("SELECT is_active FROM residents WHERE resident_id = ? AND deleted_at IS NULL");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $new_state = ((int)$row['is_active'] === 1) ? 0 : 1;
        $stmt = $conn->prepare("UPDATE residents SET is_active = ? WHERE resident_id = ?");
        $stmt->bind_param('ii', $new_state, $id);
        $stmt->execute();
        $stmt->close();

        set_flash('success', $new_state ? 'Resident account reactivated.' : 'Resident account deactivated.');
        redirect('user_management.php');
    }
}

/* ------------------------------------------------------------
   Create a staff account  (Admin only)

   The admin supplies the employment record only. The system issues the
   Staff Number, derives a username, and sets the Staff Number as the
   temporary password. The new hire supplies their own personal details
   and their own real password at first login, so no administrator ever
   knows a staff member's working password.
   ------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_staff'])) {
    if (!$is_admin) {
        $error = 'Only administrators can create staff accounts.';
    } else {
        $first_name     = trim($_POST['first_name'] ?? '');
        $middle_name    = trim($_POST['middle_name'] ?? '');
        $last_name      = trim($_POST['last_name'] ?? '');
        $name_extension = trim($_POST['name_extension'] ?? '');
        $date_hired     = trim($_POST['date_hired'] ?? '');
        $courtesy_title = resolve_courtesy_title($_POST['courtesy_title'] ?? '', $_POST['courtesy_title_other'] ?? '');

        // Every account created here is a Staff account. Admin is not offered
        // as a choice: the health center runs one administrator, and handing
        // out that role from a form is how you end up with several.
        $role = 'staff';

        $full_name = build_full_name($first_name, $middle_name, $last_name, $name_extension);

        if ($first_name === '' || $last_name === '' || $date_hired === '') {
            $error = 'First name, last name, and date hired are required.';
            $form_had_error = true;
        } elseif ($date_hired > date('Y-m-d')) {
            $error = 'Date hired cannot be in the future.';
            $form_had_error = true;
        } else {
            $staff_number = generate_staff_number($conn);

            // The Staff Number is the login username as well as the record
            // key, exactly as a Resident Number is for residents. One issued
            // identifier per person, nothing for the administrator to invent.
            $username = $staff_number;

            // Temporary password = the same Staff Number. It only survives
            // one login: is_first_login forces a real password immediately.
            $hash = password_hash($staff_number, PASSWORD_DEFAULT);

            $stmt = $conn->prepare(
                "INSERT INTO staff
                    (staff_number, username, full_name, courtesy_title, first_name, middle_name, last_name,
                     name_extension, date_hired, password, role, is_active, is_first_login, profile_completed, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?)"
            );
            $stmt->bind_param(
                'sssssssssssi',
                $staff_number, $username, $full_name, $courtesy_title, $first_name, $middle_name, $last_name,
                $name_extension, $date_hired, $hash, $role, $me
            );
            $stmt->execute();
            $stmt->close();

            set_flash('new_staff', json_encode([
                'full_name'    => with_courtesy_title($courtesy_title, $full_name),
                'staff_number' => $staff_number,
            ]));
            set_flash('success', 'Staff account created for ' . $full_name . '.');
            redirect('user_management.php');
        }
    }
}

// Only an administrator sees the staff roster, so only they load it.
$staff_list = $is_admin ? $conn->query("SELECT * FROM staff WHERE deleted_at IS NULL ORDER BY role DESC, full_name") : null;
$resident_list = $conn->query("SELECT * FROM residents WHERE deleted_at IS NULL ORDER BY last_name, first_name");

// Pending deletion requests drive the notice at the top of this page.
$pending_deletions = 0;
$pending_result = $conn->query("SELECT COUNT(*) AS c FROM resident_delete_requests WHERE status = 'pending'");
if ($pending_result) {
    $pending_deletions = (int)$pending_result->fetch_assoc()['c'];
}

require_once '../includes/header_staff.php';
?>

<div class="page-head">
    <div class="page-head-text">
        <h1>User Management</h1>
        <p>
            <?= $is_admin
                ? 'You can create staff accounts, deactivate any account, and delete resident records.'
                : 'You can deactivate resident accounts. Deleting a resident is an administrator action.' ?>
        </p>
    </div>
</div>

<?php if ($message): ?><div class="alert alert-success"><?= h($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

<?php if ($is_admin && $pending_deletions > 0): ?>
<div class="alert alert-info">
    <?= $pending_deletions ?> resident deletion <?= $pending_deletions === 1 ? 'request is' : 'requests are' ?>
    waiting for your review. <a href="deletion_requests.php">Open Deletion Requests</a>.
</div>
<?php endif; ?>

<?php if ($is_admin): ?>
<!-- ============ Staff accounts (Admin only) ============
     Staff have no business reading the roster of other staff accounts, so
     the card is withheld entirely rather than rendered read-only. Their
     view of this page is Resident Accounts and nothing else. -->
<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Staff Accounts (<?= $staff_list->num_rows ?>)</h3>
        <button type="button" class="btn" data-modal-open="add-staff-modal">+ Add Staff Account</button>
    </div>

    <!-- Search above the table so staff accounts stay easy to find as the
         list grows, matching the resident accounts table below. -->
    <div class="table-toolbar">
        <div class="search-field">
            <?= nav_icon('search') ?>
            <input type="search" id="staff-account-search" data-table-search="staff-accounts-table"
                   placeholder="Search staff accounts..." aria-label="Search staff accounts by name or staff number">
        </div>
    </div>

    <table id="staff-accounts-table" class="table-spaced">
        <tr>
            <th>Staff No.</th>
            <th>Username</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Onboarding</th>
            <th>Status</th>
            <th>Action</th>
        </tr>
        <?php while ($s = $staff_list->fetch_assoc()):
            $active = (int)($s['is_active'] ?? 1) === 1;
            $is_me = (int)$s['staff_id'] === $me;
            $awaiting_password = (int)($s['is_first_login'] ?? 0) === 1;
            $awaiting_profile = (int)($s['profile_completed'] ?? 1) === 0;
            // Searched on the staff number, the username and the full name,
            // so either an ID or a name finds the row.
            $staff_haystack = trim(($s['staff_number'] ?? '') . ' ' . $s['username'] . ' ' . $s['full_name']);
        ?>
        <tr class="<?= $active ? '' : 'row-inactive' ?>" data-search-text="<?= h($staff_haystack) ?>">
            <td><?= h($s['staff_number'] ?? '') ?></td>
            <td><?= h($s['username']) ?></td>
            <td><?= h(with_courtesy_title($s['courtesy_title'] ?? '', $s['full_name'])) ?></td>
            <td><span class="badge badge-role-<?= $s['role'] === 'admin' ? 'admin' : 'staff' ?>"><?= h(ucfirst($s['role'])) ?></span></td>
            <td>
                <?php if ($awaiting_password): ?>
                    <span class="badge badge-pending">Password not set</span>
                <?php elseif ($awaiting_profile): ?>
                    <span class="badge badge-pending">Profile incomplete</span>
                <?php else: ?>
                    <span class="badge badge-approved">Complete</span>
                <?php endif; ?>
            </td>
            <td><span class="badge <?= $active ? 'badge-active' : 'badge-inactive' ?>"><?= $active ? 'Active' : 'Deactivated' ?></span></td>
            <td>
                <?php if ($is_me): ?>
                    <span class="muted-note">(you)</span>
                <?php else: ?>
                    <div class="action-buttons">
                        <a class="btn-action btn-action-warn" href="user_management.php?reset_staff=<?= (int)$s['staff_id'] ?>"
                           title="Reset password" aria-label="Reset password"
                           data-confirm="Reset the password for <?= h($s['full_name']) ?> back to their Staff Number? They will be asked to set a new one at their next login."><?= nav_icon('lock') ?></a>
                        <?php if ($active): ?>
                        <a class="btn-action btn-action-danger" href="user_management.php?toggle_staff=<?= (int)$s['staff_id'] ?>"
                           title="Deactivate account" aria-label="Deactivate account"
                           data-confirm="Deactivate the staff account for <?= h($s['full_name']) ?>? They will not be able to log in."><?= nav_icon('power') ?></a>
                        <?php else: ?>
                        <a class="btn-action btn-action-success" href="user_management.php?toggle_staff=<?= (int)$s['staff_id'] ?>"
                           title="Reactivate account" aria-label="Reactivate account"
                           data-confirm="Reactivate the staff account for <?= h($s['full_name']) ?>?"><?= nav_icon('power') ?></a>
                        <?php endif; ?>
                        <a class="btn-action btn-action-danger" href="user_management.php?delete_staff=<?= (int)$s['staff_id'] ?>"
                           title="Delete account" aria-label="Delete account"
                           data-confirm="Delete the staff account for <?= h($s['full_name']) ?>? It moves to Deleted Accounts, where you can restore it."><?= nav_icon('trash') ?></a>
                    </div>
                <?php endif; ?>
            </td>
        </tr>
        <?php endwhile; ?>
    </table>
</div>
<?php endif; ?>

<!-- ============ Resident accounts ============ -->
<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Resident Accounts (<?= $resident_list->num_rows ?>)</h3>
        <a class="btn btn-outline btn-small" href="resident_management.php">Go to Resident Management</a>
    </div>

    <!-- Search above the table so resident accounts stay easy to find -->
    <div class="table-toolbar">
        <div class="search-field">
            <?= nav_icon('search') ?>
            <input type="search" id="resident-account-search" data-table-search="resident-accounts-table"
                   placeholder="Search resident accounts..." aria-label="Search resident accounts by name or resident number">
        </div>
    </div>

    <table id="resident-accounts-table" class="table-spaced">
        <tr>
            <th>Resident No.</th>
            <th>Name</th>
            <th>Residency</th>
            <th>Status</th>
            <th>Action</th>
        </tr>
        <?php while ($r = $resident_list->fetch_assoc()):
            $active = (int)($r['is_active'] ?? 1) === 1;
            $full_name = preg_replace('/\s+/', ' ', trim($r['first_name'] . ' ' . $r['last_name']));
            $residency = $r['residency_status'] ?? 'permanent';
        ?>
        <tr class="<?= $active ? '' : 'row-inactive' ?>" data-search-text="<?= h($r['resident_number'] . ' ' . $full_name) ?>">
            <td><?= h($r['resident_number']) ?></td>
            <td><?= h($full_name) ?></td>
            <td><span class="badge <?= $residency === 'permanent' ? 'badge-permanent' : 'badge-temporary' ?>"><?= h(ucfirst($residency)) ?></span></td>
            <td><span class="badge <?= $active ? 'badge-active' : 'badge-inactive' ?>"><?= $active ? 'Active' : 'Deactivated' ?></span></td>
            <td>
                <?php if ($active): ?>
                    <a class="btn-action btn-action-danger" title="Deactivate account" href="user_management.php?toggle_resident=<?= (int)$r['resident_id'] ?>"
                       data-confirm="Deactivate the account for <?= h($full_name) ?>? They will not be able to log in or answer surveys."><?= nav_icon('power') ?></a>
                <?php else: ?>
                    <a class="btn-action btn-action-success" title="Activate account" href="user_management.php?toggle_resident=<?= (int)$r['resident_id'] ?>"
                       data-confirm="Reactivate the account for <?= h($full_name) ?>?"><?= nav_icon('power') ?></a>
                <?php endif; ?>
            </td>
        </tr>
        <?php endwhile; ?>
        <tr class="no-match-row" style="display:none;"><td colspan="5">No resident accounts match your search.</td></tr>
    </table>
</div>

<?php if ($is_admin): ?>
<!-- Add Staff Account modal (Admin only) -->
<div class="modal-overlay<?= $form_had_error ? ' active' : '' ?>" id="add-staff-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2>Add Staff Account</h2>
        <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

        <p class="form-note">
            <span class="req">*</span> Required field. Enter the employment record only &mdash; the new hire
            fills in their own contact details and sets their own password at first login.
            The Staff Number is issued automatically and serves as the username, the
            record key, and the one-time password. All accounts created here get the
            <strong>Staff</strong> role.
        </p>

        <form method="POST">
            <input type="hidden" name="add_staff" value="1">

            <div class="grid-2">
                <div>
                    <label for="courtesy_title">Courtesy Title</label>
                    <select id="courtesy_title" name="courtesy_title" data-title-select>
                        <option value="">None</option>
                        <?php foreach (courtesy_titles() as $title): ?>
                        <option value="<?= h($title) ?>" <?= ($_POST['courtesy_title'] ?? '') === $title ? 'selected' : '' ?>><?= h($title) ?></option>
                        <?php endforeach; ?>
                        <option value="Others" <?= ($_POST['courtesy_title'] ?? '') === 'Others' ? 'selected' : '' ?>>Others</option>
                    </select>
                </div>
                <div data-title-other hidden>
                    <label for="courtesy_title_other">Specify Title</label>
                    <input type="text" id="courtesy_title_other" name="courtesy_title_other" maxlength="20"
                           placeholder="Dr., Engr., Atty." value="<?= h($_POST['courtesy_title_other'] ?? '') ?>">
                </div>
                <div>
                    <label for="first_name">First Name <span class="req">*</span></label>
                    <input type="text" id="first_name" name="first_name" required value="<?= h($_POST['first_name'] ?? '') ?>"
                        placeholder="e.g. Juan">
                </div>
                <div>
                    <label for="middle_name">Middle Name</label>
                    <input type="text" id="middle_name" name="middle_name" value="<?= h($_POST['middle_name'] ?? '') ?>"
                        placeholder="e.g. Santos">
                </div>
                <div>
                    <label for="last_name">Last Name <span class="req">*</span></label>
                    <input type="text" id="last_name" name="last_name" required value="<?= h($_POST['last_name'] ?? '') ?>"
                        placeholder="e.g. Dela Cruz">
                </div>
                <div>
                    <label for="name_extension">Name Extension</label>
                    <input type="text" id="name_extension" name="name_extension" placeholder="Jr., Sr., III" value="<?= h($_POST['name_extension'] ?? '') ?>">
                </div>
                <div>
                    <label for="date_hired">Date Hired <span class="req">*</span></label>
                    <input type="date" id="date_hired" name="date_hired" required max="<?= date('Y-m-d') ?>" value="<?= h($_POST['date_hired'] ?? date('Y-m-d')) ?>">
                </div>
            </div>

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit">Add Staff Account</button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<?php if ($new_account): ?>
<!-- Hand-over slip. Shown once, immediately after creation. -->
<div class="modal-overlay active" id="new-staff-modal" data-keep-on-close>
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Account Created</h2>
        <p class="modal-text">Give these details to <?= h($new_account['full_name']) ?>. They will be asked to set their own password and complete their profile the first time they log in.</p>

        <dl class="credential-slip">
            <dt>Staff Number</dt>
            <dd><?= h($new_account['staff_number']) ?></dd>
        </dl>

        <p class="field-hint">
            They type this Staff Number as <strong>both</strong> the username and the
            password on their first login, the same way a resident uses their Resident
            Number. They set a real password immediately afterwards; the username stays
            the Staff Number for good. If the number is lost, reset the password from the
            Staff Accounts table.
        </p>

        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>
<?php elseif ($message && !$form_had_error): ?>
<!-- Success confirmation modal -->
<div class="modal-overlay active" id="user-success-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Success</h2>
        <p class="modal-text"><?= h($message) ?></p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>
<?php endif; ?>


<script>
// "Others" hands the title over to a free-text box. Hidden until chosen so
// the form does not show a field that applies to one option in six.
(function () {
    var select = document.querySelector('[data-title-select]');
    var other = document.querySelector('[data-title-other]');
    if (!select || !other) { return; }

    function sync() {
        var custom = select.value === 'Others';
        other.hidden = !custom;
        var input = other.querySelector('input');
        if (input) {
            input.required = custom;
            if (!custom) { input.value = ''; }
        }
    }

    select.addEventListener('change', sync);
    sync();
})();
</script>

<?php require_once '../includes/footer.php'; ?>