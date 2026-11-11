<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Printable Report';
$asset_path = '../';

$surveys = $conn->query("SELECT survey_id, title FROM surveys ORDER BY created_at DESC");
$survey_id = (int)($_GET['survey_id'] ?? 0);
$survey = null;
$questions = [];
$total_respondents = 0;

if ($survey_id) {
    $stmt = $conn->prepare("SELECT s.*, st.full_name AS created_by_name FROM surveys s LEFT JOIN staff st ON st.staff_id = s.created_by WHERE s.survey_id = ?");
    $stmt->bind_param('i', $survey_id);
    $stmt->execute();
    $survey = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($survey) {
        $stmt = $conn->prepare("SELECT COUNT(*) c FROM responses WHERE survey_id = ?");
        $stmt->bind_param('i', $survey_id);
        $stmt->execute();
        $total_respondents = $stmt->get_result()->fetch_assoc()['c'];
        $stmt->close();

        $q_result = $conn->query("SELECT * FROM survey_questions WHERE survey_id = $survey_id ORDER BY question_order ASC");
        while ($q = $q_result->fetch_assoc()) {
            $qid = $q['question_id'];
            if ($q['question_type'] === 'multiple_choice') {
                $stmt = $conn->prepare("
                    SELECT c.choice_text, COUNT(sr.answer_id) AS votes
                    FROM survey_choices c
                    LEFT JOIN survey_results sr ON sr.choice_id = c.choice_id
                    WHERE c.question_id = ? GROUP BY c.choice_id, c.choice_text
                ");
            } elseif ($q['question_type'] === 'yesno') {
                // Yes and No both belong in the report even at zero, so the
                // reader can see the split rather than guess at a missing row.
                $stmt = $conn->prepare("
                    SELECT o.choice_text, COUNT(sr.answer_id) AS votes
                    FROM (SELECT 'Yes' AS choice_text UNION ALL SELECT 'No') o
                    LEFT JOIN survey_results sr
                           ON sr.answer_text = o.choice_text AND sr.question_id = ?
                    GROUP BY o.choice_text ORDER BY o.choice_text DESC
                ");
            } elseif ($q['question_type'] === 'rating') {
                // Same for the 1-5 scale: an unused star still gets a row.
                $stmt = $conn->prepare("
                    SELECT CONCAT(o.n,' star(s)') AS choice_text, COUNT(sr.answer_id) AS votes
                    FROM (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3
                          UNION ALL SELECT 4 UNION ALL SELECT 5) o
                    LEFT JOIN survey_results sr
                           ON sr.rating_value = o.n AND sr.question_id = ?
                    GROUP BY o.n ORDER BY o.n
                ");
            } else {
                $stmt = $conn->prepare("SELECT answer_text FROM survey_results WHERE question_id = ? AND answer_text IS NOT NULL AND answer_text != ''");
            }
            $stmt->bind_param('i', $qid);
            $stmt->execute();
            $q['rows'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            $questions[] = $q;
        }
    }
}

require_once '../includes/header_staff.php';
?>
<div class="page-head no-print">
    <div class="page-head-text">
        <h1>Reports</h1>
        <p>Generate a printable or exportable report for any survey.</p>
    </div>
</div>

<div class="card no-print">
    <form method="GET">
        <label for="survey_id">Select a Survey</label>
        <select id="survey_id" name="survey_id" onchange="this.form.submit()">
            <option value="">-- Choose a survey --</option>
            <?php while ($s = $surveys->fetch_assoc()): ?>
                <option value="<?= (int)$s['survey_id'] ?>" <?= $s['survey_id'] == $survey_id ? 'selected' : '' ?>><?= h($s['title']) ?></option>
            <?php endwhile; ?>
        </select>
    </form>
    <?php if ($survey_id): ?>
        <div style="margin-top:14px;">
            <button type="button" class="btn" onclick="window.print()">Print Report</button>
            <a class="btn btn-secondary" href="export_csv.php?survey_id=<?= $survey_id ?>">Export to CSV (Excel)</a>
        </div>
    <?php endif; ?>
</div>

<?php if ($survey): ?>
<div class="card">
    <h2 style="text-align:center;margin-bottom:0;">Barangay Health Center</h2>
    <p style="text-align:center;color:#6b7c76;margin-top:4px;">Survey Report</p>
    <hr>
    <p><strong>Survey Title:</strong> <?= h($survey['title']) ?></p>
    <p><strong>Description:</strong> <?= h($survey['description']) ?></p>
    <p><strong>Period:</strong> <?= h($survey['start_date']) ?> to <?= h($survey['end_date']) ?></p>
    <p><strong>Prepared by:</strong> <?= h($survey['created_by_name'] ?? 'N/A') ?></p>
    <p><strong>Total Respondents:</strong> <?= (int)$total_respondents ?></p>
    <p><strong>Generated on:</strong> <?= h(date('F j, Y \a\t g:i A')) ?></p>
</div>

<?php foreach ($questions as $i => $q): ?>
<div class="card">
    <h3><?= ($i + 1) . '. ' . h($q['question_text']) ?></h3>
    <?php
        // Denominator for this question, so a percentage read off the counts
        // is never mistaken for a share of the whole barangay.
        $answered_here = $q['question_type'] === 'short_answer'
            ? count($q['rows'])
            : array_sum(array_column($q['rows'], 'votes'));
    ?>
    <p class="muted-note">Based on <?= (int)$answered_here ?> response<?= $answered_here === 1 ? '' : 's' ?>.</p>
    <?php if ($q['question_type'] === 'short_answer'): ?>
        <?php if (empty($q['rows'])): ?>
            <p style="color:#6b7c76;">No responses.</p>
        <?php else: ?>
            <ul><?php foreach ($q['rows'] as $r): ?><li><?= h($r['answer_text']) ?></li><?php endforeach; ?></ul>
        <?php endif; ?>
    <?php else: ?>
        <table>
            <tr><th>Option</th><th>Count</th></tr>
            <?php foreach ($q['rows'] as $r): ?>
                <tr><td><?= h($r['choice_text']) ?></td><td><?= (int)$r['votes'] ?></td></tr>
            <?php endforeach; ?>
        </table>
    <?php endif; ?>
</div>
<?php endforeach; ?>
<?php elseif ($survey_id): ?>
<div class="alert alert-error">Survey not found.</div>
<?php else: ?>
<!-- Nothing chosen yet: explain why the area below is blank. -->
<div class="card no-print">
    <div class="empty-panel">
        <span class="empty-panel-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                <path d="M14 2v6h6"/>
                <path d="M9 15h6M9 11h3"/>
            </svg>
        </span>
        <h3>No Report Selected</h3>
        <p>Choose a survey from the dropdown above to generate its printable report.</p>
    </div>
</div>
<?php endif; ?>

<?php require_once '../includes/footer.php'; ?>
