<?php
/**
 * Dashboard stat card detail pages.
 *
 * Every clickable card on the staff/admin dashboard opens this file with a
 * ?view= parameter instead of jumping to a sidebar section. One file rather
 * than eight keeps the layout, breadcrumb, and access rules in a single place.
 *
 * The view name is matched against a whitelist below, so an unknown or
 * tampered value can never reach a query.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$asset_path = '../';
$is_admin_view = staff_is_admin();

/**
 * Each view supplies its own heading, column list, SQL, and a row renderer.
 * The renderer returns cells that are already escaped, so the table loop
 * below stays generic without becoming an XSS hole.
 */
$views = [

    'total_surveys' => [
        'title'    => 'Total Surveys',
        'subtitle' => 'Every survey ever created, newest first.',
        'unit'     => 'surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Period', 'Status', 'Responses', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.start_date, s.end_date, s.status,
                   COUNT(r.response_id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.survey_id
            GROUP BY s.survey_id, s.title, s.start_date, s.end_date, s.status
            ORDER BY s.created_at DESC",
        'row'      => function ($r) {
            return [
                h($r['title']),
                h(date('M j, Y', strtotime($r['start_date']))) . ' &ndash; ' . h(date('M j, Y', strtotime($r['end_date']))),
                '<span class="badge ' . ($r['status'] === 'active' ? 'badge-active' : 'badge-inactive') . '">'
                    . h(ucfirst($r['status'])) . '</span>',
                (int)$r['response_count'],
                '<a href="results_dashboard.php?survey_id=' . (int)$r['survey_id'] . '">View Results</a>',
            ];
        },
    ],

    'active_surveys' => [
        'title'    => 'Active Surveys',
        'subtitle' => 'Surveys marked active and currently inside their open period.',
        'unit'     => 'open surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Closes On', 'Days Left', 'Responses', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.end_date,
                   DATEDIFF(s.end_date, CURDATE()) AS days_left,
                   COUNT(r.response_id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.survey_id
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
            GROUP BY s.survey_id, s.title, s.end_date
            ORDER BY s.end_date ASC",
        'row'      => function ($r) {
            $days = (int)$r['days_left'];
            $tone = $days <= 3 ? 'badge-inactive' : 'badge-active';
            return [
                h($r['title']),
                h(date('M j, Y', strtotime($r['end_date']))),
                '<span class="badge ' . $tone . '">' . $days . ' day' . ($days === 1 ? '' : 's') . '</span>',
                (int)$r['response_count'],
                '<a href="results_dashboard.php?survey_id=' . (int)$r['survey_id'] . '">View Results</a>',
            ];
        },
    ],

    'total_residents' => [
        'title'    => 'Total Residents',
        'subtitle' => 'All registered resident accounts.',
        'unit'     => 'residents',
        'admin'    => false,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency', 'Account'],
        'sql'      => "
            SELECT resident_id, resident_number, first_name, last_name,
                   contact_number, residency_status, is_active
            FROM residents
            WHERE deleted_at IS NULL
            ORDER BY last_name ASC, first_name ASC",
        'row'      => function ($r) {
            return [
                h($r['resident_number']),
                h($r['first_name'] . ' ' . $r['last_name']),
                h($r['contact_number'] ?: '—'),
                h(ucfirst($r['residency_status'] ?: '—')),
                '<span class="badge ' . ((int)$r['is_active'] === 1 ? 'badge-active' : 'badge-inactive') . '">'
                    . ((int)$r['is_active'] === 1 ? 'Active' : 'Deactivated') . '</span>',
            ];
        },
    ],

    'total_responses' => [
        'title'    => 'Survey Responses',
        'subtitle' => 'Every response submitted, newest first.',
        'unit'     => 'responses',
        'admin'    => false,
        'columns'  => ['Survey', 'Resident', 'Submitted'],
        'sql'      => "
            SELECT s.title, r.submitted_at,
                   CONCAT(res.first_name, ' ', res.last_name) AS resident_name
            FROM responses r
            JOIN surveys s ON s.survey_id = r.survey_id
            LEFT JOIN residents res ON res.resident_id = r.resident_id
            ORDER BY r.submitted_at DESC
            LIMIT 200",
        'row'      => function ($r) {
            return [
                h($r['title']),
                h($r['resident_name'] ?: 'Removed resident'),
                h(date('M j, Y g:i A', strtotime($r['submitted_at']))),
            ];
        },
    ],

    // ---------- Administrator-only views ----------

    'staff_accounts' => [
        'title'    => 'Staff Accounts',
        'subtitle' => 'All staff and administrator accounts.',
        'unit'     => 'accounts',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Account', 'Created'],
        'sql'      => "
            SELECT full_name, username, role, is_active, created_at
            FROM staff
            WHERE deleted_at IS NULL
            ORDER BY role ASC, full_name ASC",
        'row'      => function ($r) {
            return [
                h($r['full_name']),
                h($r['username']),
                '<span class="badge ' . ($r['role'] === 'admin' ? 'badge-active' : 'badge-inactive') . '">'
                    . h(ucfirst($r['role'])) . '</span>',
                '<span class="badge ' . ((int)$r['is_active'] === 1 ? 'badge-active' : 'badge-inactive') . '">'
                    . ((int)$r['is_active'] === 1 ? 'Active' : 'Deactivated') . '</span>',
                h(date('M j, Y', strtotime($r['created_at']))),
            ];
        },
    ],

    'deactivated_residents' => [
        'title'    => 'Deactivated Residents',
        'subtitle' => 'Resident accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated residents',
        'admin'    => true,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency'],
        'sql'      => "
            SELECT resident_number, first_name, last_name, contact_number, residency_status
            FROM residents
            WHERE is_active = 0 AND deleted_at IS NULL
            ORDER BY last_name ASC",
        'row'      => function ($r) {
            return [
                h($r['resident_number']),
                h($r['first_name'] . ' ' . $r['last_name']),
                h($r['contact_number'] ?: '—'),
                h(ucfirst($r['residency_status'] ?: '—')),
            ];
        },
    ],

    'deactivated_staff' => [
        'title'    => 'Deactivated Staff',
        'subtitle' => 'Staff accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated staff',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Created'],
        'sql'      => "
            SELECT full_name, username, role, created_at
            FROM staff
            WHERE is_active = 0 AND deleted_at IS NULL
            ORDER BY full_name ASC",
        'row'      => function ($r) {
            return [
                h($r['full_name']),
                h($r['username']),
                h(ucfirst($r['role'])),
                h(date('M j, Y', strtotime($r['created_at']))),
            ];
        },
    ],

    'recent_logins' => [
        'title'    => 'Login Activity',
        'subtitle' => 'Sign-ins across both portals, newest first.',
        'unit'     => 'sign-ins',
        'admin'    => true,
        'columns'  => ['User', 'Type', 'Date & Time'],
        'sql'      => "
            SELECT l.user_type, l.login_time,
                   st.role AS staff_role,
                   r.residency_status,
                   COALESCE(
                       CONCAT(r.first_name, ' ', r.last_name),
                       st.full_name,
                       CONCAT('User #', l.user_id)
                   ) AS person
            FROM login_history l
            LEFT JOIN residents r ON l.user_type = 'resident' AND r.resident_id = l.user_id
            LEFT JOIN staff st    ON l.user_type = 'staff'    AND st.staff_id  = l.user_id
            ORDER BY l.login_time DESC
            LIMIT 100",
        'row'      => function ($r) {
            return [
                h($r['person']),
                '<span class="badge ' . h(login_type_label($r)['badge']) . '">'
                    . h(login_type_label($r)['text']) . '</span>',
                h(date('M j, Y g:i A', strtotime($r['login_time']))),
            ];
        },
    ],
];

// Whitelist check: anything not defined above goes back to the dashboard.
$view_key = $_GET['view'] ?? '';
if (!isset($views[$view_key])) {
    redirect('dashboard.php');
}
$view = $views[$view_key];

// A staff account must not reach an administrator-only view by typing the URL.
if ($view['admin'] && !$is_admin_view) {
    redirect('dashboard.php');
}

$rows = [];
$result = $conn->query($view['sql']);
if ($result) {
    while ($r = $result->fetch_assoc()) {
        $rows[] = $r;
    }
}

$page_title = $view['title'];
require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <a class="back-link" href="dashboard.php">&larr; Back to Dashboard</a>
        <h1><?= h($view['title']) ?></h1>
        <p><?= h($view['subtitle']) ?></p>
    </div>
</div>

<!-- Count sits below the heading rule so it does not crowd the account menu -->
<div class="page-actions-row">
    <span class="detail-count">
        <strong><?= count($rows) ?></strong> <?= h($view['unit']) ?>
    </span>
</div>

<div class="card">
    <table>
        <tr>
            <?php foreach ($view['columns'] as $col): ?>
            <th><?= h($col) ?></th>
            <?php endforeach; ?>
        </tr>
        <?php if (!$rows): ?>
        <tr>
            <td colspan="<?= count($view['columns']) ?>" class="empty-state">Nothing to show here yet.</td>
        </tr>
        <?php endif; ?>
        <?php foreach ($rows as $r): ?>
        <tr>
            <?php foreach ($view['row']($r) as $cell): ?>
            <td><?= $cell ?></td>
            <?php endforeach; ?>
        </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php require_once '../includes/footer.php'; ?>
