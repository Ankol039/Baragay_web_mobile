<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$survey_id = (int)($_GET['survey_id'] ?? 0);
$stmt = $conn->prepare("SELECT title FROM surveys WHERE survey_id = ?");
$stmt->bind_param('i', $survey_id);
$stmt->execute();
$survey = $stmt->get_result()->fetch_assoc();
$stmt->close();

$page_title = 'Submission Confirmed';
$asset_path = '../';
require_once '../includes/header_resident.php';
?>
<div class="card" style="text-align:center;max-width:480px;margin:40px auto;">
    <div style="font-size:3rem;color:#2e7d32;">&#10004;</div>
    <h2>Submission confirmed</h2>
    <p style="color:#6b7c76;">
        Your response to "<?= h($survey['title'] ?? 'the survey') ?>" has been submitted successfully.
    </p>
    <a class="btn" href="surveys.php">Back to Surveys</a>
</div>
<?php require_once '../includes/footer.php'; ?>
