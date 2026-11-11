<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$resident_id = (int)$_SESSION['resident_id'];
$response_id = (int)($_GET['id'] ?? 0);
$print_mode = isset($_GET['print']);

$stmt = $conn->prepare("
    SELECT r.response_id, r.submitted_at, s.title, s.description
    FROM responses r
    INNER JOIN surveys s ON s.survey_id = r.survey_id
    WHERE r.response_id = ? AND r.resident_id = ?
    LIMIT 1
");
$stmt->bind_param('ii', $response_id, $resident_id);
$stmt->execute();
$response = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$response) {
    redirect('history.php');
}

$stmt = $conn->prepare("
    SELECT q.question_id, q.question_text, q.question_type, q.question_order,
           sr.choice_id, sr.rating_value, sr.answer_text, sc.choice_text
    FROM survey_questions q
    LEFT JOIN survey_results sr
        ON sr.question_id = q.question_id AND sr.response_id = ?
    LEFT JOIN survey_choices sc ON sc.choice_id = sr.choice_id
    WHERE q.survey_id = (
        SELECT survey_id FROM responses WHERE response_id = ?
    )
    ORDER BY q.question_order ASC, q.question_id ASC
");
$stmt->bind_param('ii', $response_id, $response_id);
$stmt->execute();
$answers = $stmt->get_result();
$stmt->close();

$page_title = 'Submitted Response';
$asset_path = '../';
require_once '../includes/header_resident.php';
?>
<div class="page-head no-print">
    <div class="page-head-text">
        <a class="response-breadcrumb" href="history.php"><?= nav_icon('chevron-left') ?> <span>Back to Submitted Surveys</span></a>
        <h1>Submitted Response</h1>
        <p>Review the answers you submitted for this survey.</p>
    </div>
</div>

<div class="card response-print-card">
    <div class="response-header">
        <div>
            <h2><?= h($response['title']) ?></h2>
            <p class="muted-note">Submitted <?= h(date('F d, Y h:i A', strtotime($response['submitted_at']))) ?></p>
        </div>
        <div class="report-actions no-print">
            <button type="button" class="btn btn-secondary" onclick="window.print()" aria-label="Print response"><?= nav_icon('reports') ?> Print Response</button>
            <a class="btn" href="export_response.php?id=<?= $response_id ?>"><?= nav_icon('download') ?> Download CSV</a>
        </div>
    </div>

    <?php if (!empty($response['description'])): ?>
        <p class="response-description"><?= nl2br(h($response['description'])) ?></p>
    <?php endif; ?>

    <?php if ($answers->num_rows === 0): ?>
        <p class="empty-state">No answers were stored for this response.</p>
    <?php else: ?>
        <div class="submitted-answer-list">
        <?php $n = 0; while ($a = $answers->fetch_assoc()): $n++; ?>
            <div class="submitted-answer">
                <div class="submitted-question"><?= $n ?>. <?= h($a['question_text']) ?></div>
                <div class="submitted-value">
                    <?php
                    if ($a['question_type'] === 'multiple_choice') {
                        echo h($a['choice_text'] ?? 'No answer');
                    } elseif ($a['question_type'] === 'rating') {
                        echo $a['rating_value'] !== null ? h($a['rating_value'] . ' / 5') : 'No answer';
                    } else {
                        echo ($a['answer_text'] !== null && $a['answer_text'] !== '') ? nl2br(h($a['answer_text'])) : 'No answer';
                    }
                    ?>
                </div>
            </div>
        <?php endwhile; ?>
        </div>
    <?php endif; ?>
</div>

<?php if ($print_mode): ?>
<script>
window.addEventListener('load', function () { window.print(); });
</script>
<?php endif; ?>
<?php require_once '../includes/footer.php'; ?>
