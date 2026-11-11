<?php
/**
 * Single public login for both residents and staff/admin.
 * The system detects the account type automatically from the identifier.
 */
require_once 'config/db.php';
require_once 'config/functions.php';

if (isset($_SESSION['staff_id'])) {
    redirect('staff/dashboard.php');
}
if (isset($_SESSION['resident_id'])) {
    redirect('resident/dashboard.php');
}

$error = '';
$identifier = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $identifier = trim($_POST['identifier'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($identifier === '' || $password === '') {
        $error = 'Please enter your username or Resident Number and password.';
    } else {
        /* ------------------------------------------------------------------
           Step 1 — Look the identifier up in BOTH tables.

           The previous version queried staff first and only fell through to
           residents when the staff password failed. That made the account
           type depend on query order: an identifier present in both tables
           always resolved to staff, and a resident got a staff-worded error.
           Looking both up first means a collision is something we detect and
           decide about, not something that silently resolves itself.
           ------------------------------------------------------------------ */
        $stmt = $conn->prepare("SELECT * FROM staff WHERE username = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->bind_param('s', $identifier);
        $stmt->execute();
        $staff = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $stmt = $conn->prepare("SELECT * FROM residents WHERE resident_number = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->bind_param('s', $identifier);
        $stmt->execute();
        $resident = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        /* ------------------------------------------------------------------
           Step 2 — Decide which account this identifier refers to.

           The R-YYYY-NNNN format is reserved for Resident Numbers, so when
           both tables match, the format decides. This is deterministic and
           does not depend on which password happens to be correct.
           ------------------------------------------------------------------ */
        if ($staff && $resident) {
            $account_type = looks_like_resident_number($identifier) ? 'resident' : 'staff';
        } elseif ($staff) {
            $account_type = 'staff';
        } elseif ($resident) {
            $account_type = 'resident';
        } else {
            $account_type = null;
        }

        /* ------------------------------------------------------------------
           Step 3 — Verify the password against that one account only, and
           report failures in wording that matches the resolved account type.
           ------------------------------------------------------------------ */
        if ($account_type === 'staff' && password_verify($password, $staff['password'])) {
            if (isset($staff['is_active']) && (int)$staff['is_active'] === 0) {
                $error = 'This account has been deactivated. Please contact the administrator.';
            } else {
                session_regenerate_id(true); // new session ID on privilege change
                $_SESSION['staff_id'] = $staff['staff_id'];
                $_SESSION['staff_name'] = $staff['full_name'];
                $_SESSION['staff_role'] = $staff['role'];
                log_login($conn, 'staff', $staff['staff_id']);

                // A newly created account owes a real password and a
                // profile before it reaches the rest of the portal.
                if (!empty($staff['is_first_login'])) {
                    redirect('staff/change_password.php');
                }
                if (isset($staff['profile_completed']) && (int)$staff['profile_completed'] === 0) {
                    redirect('staff/complete_profile.php');
                }
                redirect('staff/dashboard.php');
            }
        } elseif ($account_type === 'resident' && password_verify($password, $resident['password'])) {
            if (isset($resident['is_active']) && (int)$resident['is_active'] === 0) {
                $error = 'This account has been deactivated. Please contact the Barangay Health Center.';
            } else {
                session_regenerate_id(true);
                $_SESSION['resident_id'] = $resident['resident_id'];
                $_SESSION['resident_name'] = trim($resident['first_name'] . ' ' . $resident['last_name']);
                log_login($conn, 'resident', $resident['resident_id']);

                if (!empty($resident['is_first_login'])) {
                    redirect('resident/change_password.php');
                }
                redirect('resident/dashboard.php');
            }
        } else {
            if ($account_type === null) {
                // Spend the same time hashing as a real check would, so an
                // attacker cannot tell existing accounts from missing ones by
                // how quickly the page responds.
                password_verify($password, '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
            }
            // Deliberately identical wording for "no such account" and "wrong
            // password" — telling them apart would confirm which identifiers
            // exist.
            $error = 'Invalid username/Resident Number or password.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign In - Barangay Health Center Survey System</title>
<link rel="stylesheet" href="assets/css/style.css?v=28">
</head>
<body>
<div class="auth-wrapper">
    <div class="auth-split">
        <div class="auth-brand">
            <img class="auth-brand-logo" src="assets/css/Logo.png?v=2" alt="Barangay Health Center Logo">
            <p class="auth-brand-tagline">Resident &amp; Staff Portal</p>
            <h1>Barangay Health Center Survey System</h1>
            <p>
                A web-based survey platform for the Barangay Health Center. Residents can
                answer surveys while authorised staff can manage residents, surveys, and results.
            </p>
            <ul class="auth-points">
                <li>One login for residents and health center personnel</li>
                <li>Your account type is detected automatically</li>
                <li>Works across desktop, tablet, and mobile devices</li>
            </ul>
        </div>

        <div class="auth-form-panel">
            <h2>Sign in</h2>
            <p class="auth-form-hint">Enter your Resident Number or staff username.</p>

            <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

            <form method="POST" novalidate>
                <label for="identifier">Username / Resident Number <span class="req">*</span></label>
                <input type="text" id="identifier" name="identifier" placeholder="e.g. R-2026-0001 or S-2026-0001"
                       value="<?= h($identifier) ?>"
                       placeholder="e.g. R-2026-0001 or admin" required autofocus>

                <label for="password">Password <span class="req">*</span></label>
                <span class="password-field">
                    <input type="password" id="password" name="password" placeholder="Enter your password" required>
                    <button type="button" class="password-toggle" data-target="password" aria-label="Show password">
                        <svg class="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" x2="23" y1="1" y2="23"/>
                        </svg>
                    </button>
                </span>

                <button type="submit" class="btn-block">Log In</button>
            </form>

            <?php // No self-service reset: an account is restored by the office that issued it. ?>
            <p class="auth-recovery">
                Forgot your password? Visit the Barangay Health Center and ask staff to
                reset it. Residents bring a valid ID; staff accounts are reset by the
                administrator.
            </p>

            <p class="auth-footnote">
                Residents use the Resident Number issued by the health center. Staff use the
                username assigned by the administrator. New accounts start with a temporary
                password and are prompted to set their own on first login.
            </p>
        </div>
    </div>
</div>

<script>
// Show/hide the password. Kept inline because the login page loads no other script.
document.querySelectorAll('.password-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
        var field = document.getElementById(toggle.getAttribute('data-target'));
        if (!field) { return; }
        var showing = field.type === 'text';
        field.type = showing ? 'password' : 'text';
        toggle.classList.toggle('is-visible', !showing);
        toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
});
</script>
</body>
</html>
