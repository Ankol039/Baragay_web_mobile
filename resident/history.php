<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$page_title = 'Submitted Surveys';
$asset_path = '../';
$resident_id = (int)$_SESSION['resident_id'];

$stmt = $conn->prepare("
    SELECT r.response_id, r.survey_id, r.submitted_at, s.title, s.description
    FROM responses r
    INNER JOIN surveys s ON s.survey_id = r.survey_id
    WHERE r.resident_id = ?
    ORDER BY r.submitted_at DESC
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$responses = $stmt->get_result();

require_once '../includes/header_resident.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Submitted Surveys</h1>
        <p>Review your previous survey responses and keep a record of what you submitted.</p>
    </div>
</div>

<div class="card">
    <?php if ($responses->num_rows === 0): ?>
        <p class="empty-state">You have not submitted any surveys yet.</p>
    <?php else: ?>
        <div class="table-responsive">
        <table class="table-spaced">
            <tr><th>Survey</th><th>Submitted</th><th>Actions</th></tr>
            <?php while ($r = $responses->fetch_assoc()): ?>
            <tr>
                <td>
                    <strong><?= h($r['title']) ?></strong>
                    <?php if (!empty($r['description'])): ?>
                        <div class="table-secondary-text"><?= h(mb_strimwidth($r['description'], 0, 90, '...')) ?></div>
                    <?php endif; ?>
                </td>
                <td><?= h(date('M d, Y h:i A', strtotime($r['submitted_at']))) ?></td>
                <td>
                    <div class="action-buttons">
                        <a class="btn-action btn-action-primary has-label" href="view_response.php?id=<?= (int)$r['response_id'] ?>" title="View submitted answers" aria-label="View submitted answers">
                            <?= nav_icon('eye') ?><span>View</span>
                        </a>
                    </div>
                </td>
            </tr>
            <?php endwhile; ?>
        </table>
        </div>
    <?php endif; ?>
</div>
<?php require_once '../includes/footer.php'; ?>
