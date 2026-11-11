<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Survey Management';
$asset_path = '../';

// Delete a survey and its related questions, choices, responses and results.
// The database relationships use ON DELETE CASCADE, so removing the survey
// also removes the dependent records that belong exclusively to it.
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    if ($id > 0) {
        $stmt = $conn->prepare("SELECT title FROM surveys WHERE survey_id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $survey = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        $stmt = $conn->prepare("DELETE FROM surveys WHERE survey_id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $deleted = $stmt->affected_rows > 0;
        $stmt->close();

        if ($deleted) {
            set_flash('success', 'Survey “' . ($survey['title'] ?? 'Survey') . '” was deleted successfully.');
        } else {
            set_flash('error', 'The selected survey could not be found or deleted.');
        }
    }
    redirect('survey_management.php');
}

// Toggle active/inactive
if (isset($_GET['toggle'])) {
    $id = (int)$_GET['toggle'];
    $stmt = $conn->prepare("UPDATE surveys SET status = IF(status='active','inactive','active') WHERE survey_id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
    redirect('survey_management.php');
}

$surveys = $conn->query("
    SELECT s.*, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.survey_id) AS response_count
    FROM surveys s ORDER BY s.created_at DESC
");

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Surveys</h1>
        <p>Create, edit and publish the surveys residents can answer.</p>
    </div>
</div>

<!-- Action sits below the heading rule so it does not crowd the account menu -->
<div class="page-actions-row">
    <a class="btn" href="add_survey.php">+ Create New Survey</a>
</div>

<div class="card">
    <div class="card-head">
        <h2 class="card-head-title">All Surveys</h2>
        <!-- Search sits in the upper-right of the card so surveys stay easy to
             find as the list grows. Filtering is client-side (see script.js). -->
        <div class="search-field">
            <?= nav_icon('search') ?>
            <input type="search" id="survey-search" data-table-search="surveys-table"
                   placeholder="Search surveys..." aria-label="Search surveys">
        </div>
    </div>

    <table id="surveys-table" class="table-spaced">
        <tr><th>Title</th><th>Period</th><th>Status</th><th>Responses</th><th>Actions</th></tr>
        <?php while ($s = $surveys->fetch_assoc()): ?>
        <tr data-search-text="<?= h($s['title'] . ' ' . $s['start_date'] . ' ' . $s['end_date'] . ' ' . $s['status']) ?>">
            <td><?= h($s['title']) ?></td>
            <td><?= h($s['start_date']) ?> &ndash; <?= h($s['end_date']) ?></td>
            <td><span class="badge <?= $s['status'] === 'active' ? 'badge-active' : 'badge-inactive' ?>"><?= h(ucfirst($s['status'])) ?></span></td>
            <td><?= (int)$s['response_count'] ?></td>
            <td>
                <div class="action-buttons">
                    <a class="btn-action" title="Edit survey" aria-label="Edit survey"
                       href="edit_survey.php?id=<?= (int)$s['survey_id'] ?>"><?= nav_icon('edit') ?></a>
                    <a class="btn-action" title="Manage questions" aria-label="Manage questions"
                       href="question_management.php?survey_id=<?= (int)$s['survey_id'] ?>"><?= nav_icon('surveys') ?></a>
                    <a class="btn-action btn-action-primary" title="View results" aria-label="View results"
                       href="results_dashboard.php?survey_id=<?= (int)$s['survey_id'] ?>"><?= nav_icon('results') ?></a>
                    <?php if ($s['status'] === 'active'): ?>
                    <a class="btn-action btn-action-danger" title="Deactivate survey" aria-label="Deactivate survey"
                       href="survey_management.php?toggle=<?= (int)$s['survey_id'] ?>"
                       data-confirm="Deactivate this survey?"><?= nav_icon('power') ?></a>
                    <?php else: ?>
                    <a class="btn-action btn-action-success" title="Activate survey" aria-label="Activate survey"
                       href="survey_management.php?toggle=<?= (int)$s['survey_id'] ?>"
                       data-confirm="Activate this survey?"><?= nav_icon('power') ?></a>
                    <?php endif; ?>
                    <a class="btn-action btn-action-danger" title="Delete survey" aria-label="Delete survey"
                       href="survey_management.php?delete=<?= (int)$s['survey_id'] ?>"
                       data-confirm="Delete “<?= h($s['title']) ?>”? This will also delete its questions, choices, responses, and results. This action cannot be undone."><?= nav_icon('trash') ?></a>
                </div>
            </td>
        </tr>
        <?php endwhile; ?>
        <tr class="no-match-row" style="display:none;"><td colspan="5">No surveys match your search.</td></tr>
    </table>
</div>
<?php require_once '../includes/footer.php'; ?>
