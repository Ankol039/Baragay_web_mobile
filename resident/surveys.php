<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$page_title = 'Available Surveys';
$asset_path = '../';
$resident_id = $_SESSION['resident_id'];

$stmt = $conn->prepare("
    SELECT s.*,
        EXISTS(SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?) AS already_answered
    FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    ORDER BY s.start_date DESC
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$all_surveys = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Split the list so "Available" means what it says: surveys still waiting on
// this resident. Answered ones stay on the page for reference, below.
$open_surveys = [];
$answered_surveys = [];
foreach ($all_surveys as $s) {
    if ($s['already_answered']) {
        $answered_surveys[] = $s;
    } else {
        $open_surveys[] = $s;
    }
}

// If we were just redirected here after answering a survey, look up its title
// so we can show a modal confirmation box.
$submitted_survey = null;
if (isset($_GET['submitted'])) {
    $submitted_id = (int)$_GET['submitted'];
    $stmt2 = $conn->prepare("SELECT title FROM surveys WHERE survey_id = ?");
    $stmt2->bind_param('i', $submitted_id);
    $stmt2->execute();
    $submitted_survey = $stmt2->get_result()->fetch_assoc();
    $stmt2->close();
}

require_once '../includes/header_resident.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Available Surveys</h1>
        <p>View and complete surveys assigned to you. Answers you have already sent are kept under <a href="history.php">Submitted Surveys</a>.</p>
    </div>
</div>

<div class="card">
    <div class="card-head">
        <div>
            <h2 class="card-head-title">Waiting for your answer (<?= count($open_surveys) ?>)</h2>
            <p class="muted-note">These are open now and you have not answered them yet.</p>
        </div>
    </div>

    <?php if (empty($open_surveys)): ?>
        <p class="empty-state">
            <?= empty($answered_surveys)
                ? 'There are no active surveys at the moment. Please check back later.'
                : 'You are all caught up. Every open survey has been answered.' ?>
        </p>
    <?php else: ?>
        <table class="table-spaced">
            <tr><th>Title</th><th>Description</th><th>Closes</th><th></th></tr>
            <?php foreach ($open_surveys as $s): ?>
            <tr>
                <td><?= h($s['title']) ?></td>
                <td><?= h(mb_strimwidth($s['description'] ?? '', 0, 80, '...')) ?></td>
                <td><?= h(date('M j, Y', strtotime($s['end_date']))) ?></td>
                <td><a class="btn btn-small" href="survey_form.php?id=<?= (int)$s['survey_id'] ?>">Answer Survey</a></td>
            </tr>
            <?php endforeach; ?>
        </table>
    <?php endif; ?>
</div>

<?php if ($answered_surveys): ?>
<div class="card">
    <div class="card-head">
        <div>
            <h2 class="card-head-title">Already answered (<?= count($answered_surveys) ?>)</h2>
            <p class="muted-note">Still open, but your response is recorded. Your answers are under Submitted Surveys.</p>
        </div>
    </div>
    <table class="table-spaced">
        <tr><th>Title</th><th>Description</th><th>Closes</th><th>Status</th></tr>
        <?php foreach ($answered_surveys as $s): ?>
        <tr>
            <td><?= h($s['title']) ?></td>
            <td><?= h(mb_strimwidth($s['description'] ?? '', 0, 80, '...')) ?></td>
            <td><?= h(date('M j, Y', strtotime($s['end_date']))) ?></td>
            <td><span class="badge badge-inactive">Answered</span></td>
        </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>

<!-- Submission confirmation modal: shown right after a resident successfully answers a survey -->
<div class="modal-overlay<?= $submitted_survey ? ' active' : '' ?>" id="submitted-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Submission confirmed</h2>
        <p style="color:var(--muted);">
            You have successfully answered the survey
            <strong>"<?= h($submitted_survey['title'] ?? 'the survey') ?>"</strong>.
        </p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>

<?php if ($submitted_survey): ?>
<script>
// Remove ?submitted=... from the address bar so refreshing won't reopen the modal
if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
}
</script>
<?php endif; ?>

<?php require_once '../includes/footer.php'; ?>
