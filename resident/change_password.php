<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$page_title = 'Change Password';
$asset_path = '../';
$error = '';

$resident_id = $_SESSION['resident_id'];
$stmt = $conn->prepare("SELECT is_first_login FROM residents WHERE resident_id = ?");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$is_first_login = $stmt->get_result()->fetch_assoc()['is_first_login'];
$stmt->close();

// Set by the redirect below, right after a successful change
$password_changed = get_flash('password_changed');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $current = $_POST['current_password'] ?? '';
    $new = $_POST['new_password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    $stmt = $conn->prepare("SELECT password FROM residents WHERE resident_id = ?");
    $stmt->bind_param('i', $resident_id);
    $stmt->execute();
    $current_hash = $stmt->get_result()->fetch_assoc()['password'];
    $stmt->close();

    $policy_failures = password_policy_errors($new);

    if (!password_verify($current, $current_hash)) {
        $error = 'Current password is incorrect.';
    } elseif ($policy_failures) {
        // Name every unmet rule at once instead of making the resident
        // resubmit to discover the next failure.
        $error = 'Your new password does not meet the requirements: ' . implode('; ', $policy_failures) . '.';
    } elseif ($new === $current) {
        $error = 'Your new password must be different from your current one.';
    } elseif ($new !== $confirm) {
        $error = 'New password and confirmation do not match.';
    } else {
        $new_hash = password_hash($new, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE residents SET password = ?, is_first_login = 0 WHERE resident_id = ?");
        $stmt->bind_param('si', $new_hash, $resident_id);
        $stmt->execute();
        $stmt->close();

        // Reload the page so the success box is shown on a clean URL.
        // Without the redirect, refreshing would re-submit the form.
        set_flash('password_changed', $is_first_login ? 'first' : 'normal');
        redirect('change_password.php');
    }
}

// While the confirmation is on screen the password is already changed,
// so the navigation is allowed back even if this was a first login.
$hide_navbar = ($is_first_login == 1) && !$password_changed;

require_once '../includes/header_resident.php';
?>
<?php
/**
 * Small helper for the show/hide eye button that sits inside each
 * password field. Rendered right after the input it controls.
 */
function password_eye($target) {
    return '<button type="button" class="password-toggle" data-target="' . h($target) . '" aria-label="Show password">'
        . '<svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        . '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>'
        . '<svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        . '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>'
        . '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>'
        . '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" x2="23" y1="1" y2="23"/></svg>'
        . '</button>';
}
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Change Password</h1>
        <p>Choose a new password for your resident account.</p>
    </div>
</div>

<div class="card card-form">

    <?php if ($is_first_login && !$password_changed): ?>
        <div class="alert alert-info">
            This is your first login. Please set a new password before continuing.
            Your current password is your Resident Number.
        </div>
    <?php endif; ?>

    <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

    <form method="POST">
        <label for="current_password">Current Password <span class="req">*</span></label>
        <span class="password-field">
            <input type="password" id="current_password" name="current_password" required autocomplete="current-password">
            <?= password_eye('current_password') ?>
        </span>

        <label for="new_password">New Password <span class="req">*</span></label>
        <span class="password-field">
            <input type="password" id="new_password" name="new_password" required minlength="8"
                   autocomplete="new-password" aria-describedby="password-rules">
            <?= password_eye('new_password') ?>
        </span>

        <div class="password-rules" id="password-rules">
            <span class="password-rules-title">Your password must have:</span>
            <ul>
                <?php foreach (password_rules() as $key => $rule): ?>
                <li data-rule="<?= h($key) ?>">
                    <span class="rule-mark" aria-hidden="true"></span>
                    <span class="rule-text"><?= h($rule[0]) ?></span>
                </li>
                <?php endforeach; ?>
            </ul>
            <small class="field-hint">Tip: a symbol such as ! or # makes it stronger, but is not required.</small>
        </div>

        <label for="confirm_password">Confirm New Password <span class="req">*</span></label>
        <span class="password-field">
            <input type="password" id="confirm_password" name="confirm_password" required minlength="8" autocomplete="new-password">
            <?= password_eye('confirm_password') ?>
        </span>
        <small class="field-hint match-hint" id="match-hint"></small>

        <button type="submit" class="btn-wide">Update Password</button>
    </form>
</div>

<!-- Password changed confirmation -->
<div class="modal-overlay<?= $password_changed ? ' active' : '' ?>" id="password-success-modal" data-keep-on-close>
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Password Changed</h2>
        <p class="modal-text">
            <?= $password_changed === 'first'
                ? 'Your account is now set up. Use your new password the next time you log in.'
                : 'Your password has been updated successfully. Use it the next time you log in.' ?>
        </p>
        <div class="modal-actions">
            <a class="btn" href="dashboard.php">Go to Dashboard</a>
            <button type="button" class="btn btn-secondary" data-modal-close>Stay Here</button>
        </div>
    </div>
</div>

<script>
// Live requirement checklist. These tests mirror password_rules() in
// config/functions.php exactly — the server re-checks on submit, so this is
// convenience only, never the actual gate.
(function () {
    var pw = document.getElementById('new_password');
    var confirm = document.getElementById('confirm_password');
    var matchHint = document.getElementById('match-hint');
    if (!pw) { return; }

    var tests = {
        length: function (v) { return v.length >= 8; },
        upper:  function (v) { return /[A-Z]/.test(v); },
        lower:  function (v) { return /[a-z]/.test(v); },
        number: function (v) { return /[0-9]/.test(v); },
        space:  function (v) { return v.length > 0 && !/\s/.test(v); }
    };

    function review() {
        var value = pw.value;
        document.querySelectorAll('#password-rules li').forEach(function (li) {
            var key = li.getAttribute('data-rule');
            var ok = tests[key] ? tests[key](value) : false;
            li.classList.toggle('rule-met', value.length > 0 && ok);
        });
        checkMatch();
    }

    function checkMatch() {
        if (!confirm || !matchHint) { return; }
        if (confirm.value.length === 0) {
            matchHint.textContent = '';
            matchHint.classList.remove('match-ok', 'match-bad');
            return;
        }
        var same = confirm.value === pw.value;
        matchHint.textContent = same ? 'Passwords match.' : 'Passwords do not match yet.';
        matchHint.classList.toggle('match-ok', same);
        matchHint.classList.toggle('match-bad', !same);
    }

    pw.addEventListener('input', review);
    if (confirm) { confirm.addEventListener('input', checkMatch); }
})();
</script>

<?php require_once '../includes/footer.php'; ?>
