<?php
/**
 * Resident dashboard stat card detail pages.
 *
 * Mirrors staff/stat_detail.php: each card opens its own page through a
 * whitelisted ?view= parameter rather than linking into the sidebar menu.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$asset_path = '../';
$resident_id = (int)$_SESSION['resident_id'];

$views = [

    'available' => [
        'title'    => 'Surveys Available',
        'subtitle' => 'Open surveys you have not answered yet.',
        'unit'     => 'Surveys Waiting',
        'columns'  => ['Survey', 'Description', 'Closes On', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.description, s.end_date
            FROM surveys s
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
              AND NOT EXISTS (
                  SELECT 1 FROM responses r
                  WHERE r.survey_id = s.survey_id AND r.resident_id = ?
              )
            ORDER BY s.end_date ASC",
        'row'      => function ($r) {
            return [
                h($r['title']),
                h($r['description'] ?: '—'),
                h(date('M j, Y', strtotime($r['end_date']))),
                '<a class="btn btn-small" href="survey_form.php?id=' . (int)$r['survey_id'] . '">Answer Survey</a>',
            ];
        },
    ],

    'completed' => [
        'title'    => 'Surveys Completed',
        'subtitle' => 'Surveys you have already submitted answers for.',
        'unit'     => 'Surveys Completed',
        'columns'  => ['Survey', 'Submitted On', 'Status'],
        'sql'      => "
            SELECT s.title, r.submitted_at
            FROM responses r
            JOIN surveys s ON s.survey_id = r.survey_id
            WHERE r.resident_id = ?
            ORDER BY r.submitted_at DESC",
        'row'      => function ($r) {
            return [
                h($r['title']),
                h(date('M j, Y g:i A', strtotime($r['submitted_at']))),
                '<span class="badge badge-active">Submitted</span>',
            ];
        },
    ],

    'assigned' => [
        'title'    => 'Surveys Assigned',
        'subtitle' => 'Every currently open survey assigned to you, with your answer status.',
        'unit'     => 'Surveys Assigned',
        'columns'  => ['Survey', 'Closes On', 'Status', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.end_date,
                   EXISTS (
                       SELECT 1 FROM responses r
                       WHERE r.survey_id = s.survey_id AND r.resident_id = ?
                   ) AS answered
            FROM surveys s
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
            ORDER BY answered ASC, s.end_date ASC",
        'row'      => function ($r) {
            $done = (int)$r['answered'] === 1;
            return [
                h($r['title']),
                h(date('M j, Y', strtotime($r['end_date']))),
                '<span class="badge ' . ($done ? 'badge-active' : 'badge-inactive') . '">'
                    . ($done ? 'Answered' : 'Not yet answered') . '</span>',
                $done ? '' : '<a class="btn btn-small" href="survey_form.php?id=' . (int)$r['survey_id'] . '">Answer Survey</a>',
            ];
        },
    ],
];

$view_key = $_GET['view'] ?? '';
if (!isset($views[$view_key])) {
    redirect('dashboard.php');
}
$view = $views[$view_key];

// Every query here is scoped to the signed-in resident, so the id is bound
// rather than interpolated — a resident must never be able to read another
// resident's answers by editing the URL.
$rows = [];
$stmt = $conn->prepare($view['sql']);
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$result = $stmt->get_result();
while ($r = $result->fetch_assoc()) {
    $rows[] = $r;
}
$stmt->close();

$page_title = $view['title'];
require_once '../includes/header_resident.php';
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
