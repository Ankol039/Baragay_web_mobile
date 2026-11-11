<?php
require_once __DIR__ . '/icons.php';
$current_page = basename($_SERVER['PHP_SELF']);
function nav_active_r($file, $current) { return $file === $current ? ' active' : ''; }
$asset_base = isset($asset_path) && $asset_path !== '' ? rtrim($asset_path, '/') : '..';
$css_path = $asset_base . '/assets/css/style.css';
$logo_path = $asset_base . '/assets/css/Logo.png';

// Pull the resident's status flags for the sidebar. Read fresh on every
// page load so a change made by staff shows up without a re-login.
$residency_status = '';
$is_first_login = false;
$header_photo = '';
$header_first_name = '';
$header_courtesy_title = '';
$header_residence_type = '';
if (isset($_SESSION['resident_id']) && isset($conn)) {
    $header_rid = (int)$_SESSION['resident_id'];

    // photo_path may not exist on older installations; add it before selecting it
    if (function_exists('ensure_resident_photo_column')) {
        ensure_resident_photo_column($conn);
    }

    $header_stmt = $conn->prepare("SELECT residency_status, is_first_login, is_active, photo_path, courtesy_title, residence_type, first_name, deleted_at FROM residents WHERE resident_id = ?");
    if ($header_stmt) {
        $header_stmt->bind_param('i', $header_rid);
        $header_stmt->execute();
        $header_row = $header_stmt->get_result()->fetch_assoc();
        $header_stmt->close();

        $header_photo = $header_row['photo_path'] ?? '';
        $header_first_name = (string)($header_row['first_name'] ?? '');
        $header_courtesy_title = (string)($header_row['courtesy_title'] ?? '');
        $header_residence_type = (string)($header_row['residence_type'] ?? '');

        $found_status = $header_row['residency_status'] ?? '';
        if (in_array($found_status, ['permanent', 'temporary'], true)) {
            $residency_status = $found_status;
        }
        $is_first_login = !empty($header_row['is_first_login']);

        // Deactivated or deleted mid-session by staff: end the session
        // immediately instead of letting the resident keep browsing.
        if ($header_row && isset($header_row['is_active']) && (int)$header_row['is_active'] === 0) {
            redirect('logout.php');
        }
        if ($header_row && !empty($header_row['deleted_at'])) {
            redirect('logout.php');
        }
    }
}

// On a first login the resident must set a password before anything else,
// so the navigation is withheld entirely - there is nowhere else to go yet.
// A page can also force this by setting $hide_navbar before the include.
$hide_navbar = ($hide_navbar ?? false) || $is_first_login;
$show_sidebar = isset($_SESSION['resident_id']) && !$hide_navbar;
$resident_name = $_SESSION['resident_name'] ?? '';
// Held before the title is added: the chip initial comes from the
// person's own name, never from "Mr." or "Ms.".
$resident_plain_name = $resident_name;
if (function_exists('with_courtesy_title')) {
    $resident_name = with_courtesy_title($header_courtesy_title ?? '', $resident_name);
}

// Fall back to the initial whenever the stored photo file is missing,
// so a dangling path never renders as a broken image.
$header_has_photo = function_exists('account_photo_exists')
    ? account_photo_exists($header_photo, __DIR__ . '/..')
    : ($header_photo !== '');
$header_initial = function_exists('account_initial')
    ? account_initial($header_first_name, $resident_plain_name, $header_courtesy_title, 'R')
    : 'R';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= isset($page_title) ? h($page_title) . ' - ' : '' ?>Barangay Health Center Survey System</title>
<link rel="stylesheet" href="<?= $css_path ?>?v=30">
</head>
<body class="<?= $show_sidebar ? 'portal-layout' : '' ?>">

<?php if ($show_sidebar): ?>
<aside class="sidebar no-print" id="app-sidebar">
    <button type="button" class="sidebar-close mobile-nav-close" aria-label="Close navigation" title="Close navigation">&times;</button>
    <div class="sidebar-header">
        <div class="sidebar-logo">
            <img class="sidebar-logo-img" src="<?= $logo_path ?>?v=2" alt="Barangay Health Center Logo">
            <span class="sidebar-logo-text">
                Barangay Health Center
                <small>Survey Management System</small>
            </span>
        </div>
        <?php // "Permanent Resident" / "Temporary Resident" stays in the sidebar. ?>
        <?php if ($residency_status !== ''): ?>
        <span class="sidebar-role<?= $residency_status === 'temporary' ? ' sidebar-role-temporary' : '' ?>">
            <?= h(ucfirst($residency_status)) ?> Resident
        </span>
        <?php endif; ?>

        <?php
        // What KIND of temporary residence, directly under the status badge.
        // Only meaningful for a temporary resident, and only when a type is
        // actually on file.
        $residence_type_name = ($residency_status === 'temporary' && function_exists('residence_type_label'))
            ? residence_type_label($header_residence_type)
            : '';
        ?>
        <?php if ($residence_type_name !== ''): ?>
        <span class="sidebar-residence-type" title="<?= h($header_residence_type) ?> &mdash; <?= h($residence_type_name) ?>">
            <?= h($header_residence_type) ?> &middot; <?= h($residence_type_name) ?>
        </span>
        <?php endif; ?>
    </div>

    <nav>
        <a class="nav-item<?= nav_active_r('dashboard.php', $current_page) ?>" href="dashboard.php"><?= nav_icon('dashboard') ?><span>Dashboard</span></a>
        <a class="nav-item<?= nav_active_r('surveys.php', $current_page) ?>" href="surveys.php"><?= nav_icon('surveys') ?><span>Available Surveys</span></a>
        <a class="nav-item<?= nav_active_r('history.php', $current_page) ?>" href="history.php"><?= nav_icon('reports') ?><span>Submitted Surveys</span></a>
        <a class="nav-item<?= nav_active_r('profile.php', $current_page) ?>" href="profile.php"><?= nav_icon('profile') ?><span>My Profile</span></a>
        <a class="nav-item<?= nav_active_r('change_password.php', $current_page) ?>" href="change_password.php"><?= nav_icon('password') ?><span>Change Password</span></a>
    </nav>

</aside>
<div class="nav-drawer-backdrop" id="nav-drawer-backdrop" aria-hidden="true"></div>
<?php else: ?>
<!-- No navigation: first-time login, or not signed in -->
<div class="plain-topbar no-print">
    <img src="<?= $logo_path ?>?v=2" alt="Barangay Health Center Logo">
    <span class="plain-topbar-text">
        Barangay Health Center
        <small>Survey Management System</small>
    </span>
    <?php if (isset($_SESSION['resident_id'])): ?>
    <a class="plain-topbar-logout" href="logout.php"><?= nav_icon('logout') ?><span>Logout</span></a>
    <?php endif; ?>
</div>
<?php endif; ?>

<div class="app-main">

<?php if ($show_sidebar): ?>
<!-- Account indicator: upper-right corner. The profile picture sits beside
     the account type, and the portal options moved here from the sidebar. -->
<div class="app-topbar no-print">
    <button type="button" class="mobile-nav-toggle mobile-nav-trigger" id="mobile-nav-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="app-sidebar">&#9776;</button>
    <div class="mobile-brand" aria-hidden="true">
        <img src="<?= $logo_path ?>?v=2" alt="">
        <span>Barangay Health Center<small>Survey Management System</small></span>
    </div>
    <div class="account-tab">
        <button type="button" class="account-chip" id="account-chip" title="<?= h($resident_name) ?>" aria-expanded="false" aria-haspopup="true" aria-controls="account-menu">
            <?php if ($header_has_photo): ?>
                <?php // alt is empty on purpose: if the file 404s at request time,
                      // the onerror handler swaps in the initial rather than the
                      // browser painting alt text inside a 34px circle. ?>
                <img class="account-avatar" src="<?= h($asset_base . '/' . $header_photo) ?>" alt=""
                     onerror="this.style.display='none';var f=document.getElementById('account-avatar-fallback');if(f){f.style.display='grid';}">
                <span class="account-avatar" id="account-avatar-fallback" style="display:none;"><?= h($header_initial) ?></span>
            <?php else: ?>
                <span class="account-avatar"><?= h($header_initial) ?></span>
            <?php endif; ?>
            <span class="account-meta">
                <span class="account-name"><?= h($resident_name) ?></span>
                <span class="account-type">Resident Portal</span>
            </span>
            <?= str_replace('width="18" height="18"', 'class="account-caret" width="14" height="14"', nav_icon('chevron')) ?>
        </button>

        <div class="account-menu" id="account-menu">
            <!-- Full name, never truncated, so the chip's "..." can always be resolved -->
            <span class="account-menu-name"><?= h($resident_name) ?></span>
            <span class="account-menu-role">Resident Portal</span>
            <div class="account-menu-divider"></div>
            <!-- <span class="account-menu-label">Portals</span> -->
            <!-- <a class="is-current" href="dashboard.php"><?= nav_icon('profile') ?><span>Resident Portal</span></a>
            <a href="<?= $asset_base ?>/staff/login.php"><?= nav_icon('staff') ?><span>Admin Portal</span></a> -->
            <!-- <div class="account-menu-divider"></div> -->
            <a href="profile.php"><?= nav_icon('profile') ?><span>My Profile</span></a>
            <a class="account-menu-danger" href="logout.php"><?= nav_icon('logout') ?><span>Logout</span></a>
        </div>
    </div>
</div>
<?php endif; ?>

<div class="container">
