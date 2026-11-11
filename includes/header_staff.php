<?php
require_once __DIR__ . '/icons.php';
$current_page = basename($_SERVER['PHP_SELF']);
function nav_active($file, $current) { return $file === $current ? ' active' : ''; }
$asset_base = isset($asset_path) && $asset_path !== '' ? rtrim($asset_path, '/') : '..';
$css_path = $asset_base . '/assets/css/style.css';
$logo_path = $asset_base . '/assets/css/Logo.png';

$role = strtolower(trim($_SESSION['staff_role'] ?? $_SESSION['role'] ?? ''));
$is_admin = ($role === 'admin');
$portal_label = $is_admin ? 'Admin Portal' : 'Staff Portal';
$staff_name = $_SESSION['staff_name'] ?? '';
$logged_in = isset($_SESSION['staff_id']);

/**
 * Photo and courtesy title for the account chip.
 *
 * Read from the table rather than the session: the session is written at
 * login, so a photo uploaded mid-session would not appear in the corner
 * until the next login without this.
 */
$header_photo = '';
$header_first_name = '';
$header_courtesy = '';
$header_plain_name = '';
if ($logged_in && isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
    $header_stmt = $GLOBALS['conn']->prepare("SELECT photo_path, courtesy_title, full_name, first_name, deleted_at FROM staff WHERE staff_id = ?");
    if ($header_stmt) {
        $header_stmt->bind_param('i', $_SESSION['staff_id']);
        $header_stmt->execute();
        if ($header_row = $header_stmt->get_result()->fetch_assoc()) {
            // Deleted mid-session by another administrator: end the session
            // now rather than letting an archived account keep working.
            if (!empty($header_row['deleted_at'])) {
                $header_stmt->close();
                redirect('logout.php');
            }
            $header_photo = (string)($header_row['photo_path'] ?? '');
            $header_first_name = (string)($header_row['first_name'] ?? '');
            $header_courtesy = (string)($header_row['courtesy_title'] ?? '');
            if (trim((string)($header_row['full_name'] ?? '')) !== '') {
                $staff_name = $header_row['full_name'];
            }
            // Kept without the title: the chip initial is taken from the
            // person's name, never from "Mr." or "Ms.".
            $header_plain_name = $staff_name;
            if (function_exists('with_courtesy_title')) {
                $staff_name = with_courtesy_title($header_courtesy, $staff_name);
            }
        }
        $header_stmt->close();
    }
}

// Fall back to the initial whenever the stored photo file is missing,
// so a dangling path never renders as a broken image.
$header_has_photo = function_exists('account_photo_exists')
    ? account_photo_exists($header_photo, __DIR__ . '/..')
    : ($header_photo !== '');
$header_initial = function_exists('account_initial')
    ? account_initial($header_first_name, $header_plain_name !== '' ? $header_plain_name : $staff_name, $header_courtesy, 'S')
    : 'S';

// During onboarding a staff member owes a password and a profile before
// anything else, so the navigation is withheld - there is nowhere else to
// go yet. A page forces this by setting $hide_navbar before the include.
$hide_navbar = $hide_navbar ?? false;
$show_sidebar = $logged_in && !$hide_navbar;

// Pending deletion requests are surfaced in the sidebar so an administrator
// does not have to go looking for them.
$pending_deletions = 0;
if ($is_admin && isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
    $pending_lookup = $GLOBALS['conn']->query("SELECT COUNT(*) AS c FROM resident_delete_requests WHERE status = 'pending'");
    if ($pending_lookup) {
        $pending_deletions = (int)$pending_lookup->fetch_assoc()['c'];
    }
}

// How many accounts are sitting in the archive waiting to be restored
// or cleared out.
$archived_accounts = 0;
if ($is_admin && isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof mysqli) {
    $archived_lookup = $GLOBALS['conn']->query("SELECT
            (SELECT COUNT(*) FROM residents WHERE deleted_at IS NOT NULL)
          + (SELECT COUNT(*) FROM staff     WHERE deleted_at IS NOT NULL) AS c");
    if ($archived_lookup) {
        $archived_accounts = (int)$archived_lookup->fetch_assoc()['c'];
    }
}
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
    </div>

    <nav>
        <a class="nav-item<?= nav_active('dashboard.php', $current_page) ?>" href="dashboard.php"><?= nav_icon('dashboard') ?><span>Dashboard</span></a>

        <span class="sidebar-section-label">Surveys</span>
        <a class="nav-item<?= nav_active('survey_management.php', $current_page) ?>" href="survey_management.php"><?= nav_icon('surveys') ?><span>Surveys</span></a>
        <a class="nav-item<?= nav_active('results_dashboard.php', $current_page) ?>" href="results_dashboard.php"><?= nav_icon('results') ?><span>Results</span></a>
        <a class="nav-item<?= nav_active('reports.php', $current_page) ?>" href="reports.php"><?= nav_icon('reports') ?><span>Reports</span></a>

        <span class="sidebar-section-label">People</span>
        <a class="nav-item<?= nav_active('resident_management.php', $current_page) ?>" href="resident_management.php"><?= nav_icon('residents') ?><span>Registered Resident</span></a>
        <a class="nav-item<?= nav_active('address_requests.php', $current_page) ?>" href="address_requests.php"><?= nav_icon('residents') ?><span>Address Requests</span></a>
        <a class="nav-item<?= nav_active('user_management.php', $current_page) ?>" href="user_management.php"><?= nav_icon('staff') ?><span>User Management</span></a>
        <a class="nav-item<?= nav_active('deletion_requests.php', $current_page) ?>" href="deletion_requests.php"><?= nav_icon('trash') ?><span>Deletion Requests</span><?php if ($pending_deletions > 0): ?><span class="nav-count"><?= $pending_deletions ?></span><?php endif; ?></a>
        <?php if ($is_admin): ?>
        <a class="nav-item<?= nav_active('residency_records.php', $current_page) ?>" href="residency_records.php"><?= nav_icon('clock') ?><span>Residency Records</span></a>
        <a class="nav-item<?= nav_active('deleted_accounts.php', $current_page) ?>" href="deleted_accounts.php"><?= nav_icon('switch') ?><span>Deleted Accounts</span><?php if ($archived_accounts > 0): ?><span class="nav-count"><?= $archived_accounts ?></span><?php endif; ?></a>
        <?php endif; ?>
    </nav>

</aside>
<div class="nav-drawer-backdrop" id="nav-drawer-backdrop" aria-hidden="true"></div>
<?php endif; ?>

<div class="app-main">

<?php if ($logged_in): ?>
<!-- Account indicator: upper-right corner, holds the portal options
     that used to sit in the sidebar. -->
<div class="app-topbar no-print">
    <button type="button" class="mobile-nav-toggle mobile-nav-trigger" id="mobile-nav-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="app-sidebar">&#9776;</button>
    <div class="mobile-brand" aria-hidden="true">
        <img src="<?= $logo_path ?>?v=2" alt="">
        <span>Barangay Health Center<small>Survey Management System</small></span>
    </div>
    <div class="account-tab">
        <button type="button" class="account-chip" id="account-chip" title="<?= h($staff_name) ?>" aria-expanded="false" aria-haspopup="true" aria-controls="account-menu">
            <?php if ($header_has_photo): ?>
                <?php // alt is empty on purpose: if the file 404s at request time,
                      // the onerror handler swaps in the initial rather than the
                      // browser painting alt text inside a 34px circle. ?>
                <img class="account-avatar" src="<?= h($asset_base . '/' . $header_photo) ?>?v=<?= time() ?>" alt=""
                     onerror="this.style.display='none';var f=document.getElementById('account-avatar-fallback');if(f){f.style.display='grid';}">
                <span class="account-avatar" id="account-avatar-fallback" style="display:none;"><?= h($header_initial) ?></span>
            <?php else: ?>
                <span class="account-avatar"><?= h($header_initial) ?></span>
            <?php endif; ?>
            <span class="account-meta">
                <span class="account-name"><?= h($staff_name) ?></span>
                <span class="account-type"><?= h($portal_label) ?></span>
            </span>
            <?= str_replace('width="18" height="18"', 'class="account-caret" width="14" height="14"', nav_icon('chevron')) ?>
        </button>

        <div class="account-menu" id="account-menu">
            <!-- Full name, never truncated, so the chip's "..." can always be resolved -->
            <span class="account-menu-name"><?= h($staff_name) ?></span>
            <span class="account-menu-role"><?= h($portal_label) ?></span>
            <div class="account-menu-divider"></div>
            <a href="complete_profile.php"><?= nav_icon('profile') ?><span>My Profile</span></a>
            <a href="change_password.php"><?= nav_icon('password') ?><span>Change Password</span></a>
            <div class="account-menu-divider"></div>
            <!-- <span class="account-menu-label">Portals</span>
            <a class="is-current" href="dashboard.php"><?= nav_icon('staff') ?><span><?= h($portal_label) ?></span></a>
            <a href="<?= $asset_base ?>/resident/login.php"><?= nav_icon('profile') ?><span>Resident Portal</span></a>
            <div class="account-menu-divider"></div> -->
            <a class="account-menu-danger" href="logout.php"><?= nav_icon('logout') ?><span>Logout</span></a>
        </div>
    </div>
</div>
<?php endif; ?>

<div class="container">
