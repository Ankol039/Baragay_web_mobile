<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Edit Survey';
$asset_path = '../';
$survey_id = (int)($_GET['id'] ?? 0);
$error = '';
$message = '';

$stmt = $conn->prepare("SELECT * FROM surveys WHERE survey_id = ?");
$stmt->bind_param('i', $survey_id);
$stmt->execute();
$survey = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$survey) {
    redirect('survey_management.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $start_date = $_POST['start_date'] ?? '';
    $end_date = $_POST['end_date'] ?? '';
    $status = $_POST['status'] ?? 'active';

    if ($title === '' || $start_date === '' || $end_date === '') {
        $error = 'Title, start date, and end date are required.';
    } elseif (!valid_written_text($title, 8)) {
        $error = 'Give the survey a real title - at least eight characters that describe what it is about.';
    } elseif ($description !== '' && !valid_written_text($description, 10)) {
        $error = 'Either write a proper description of at least ten characters, or leave it blank.';
    } elseif ($start_date > $end_date) {
        $error = 'Start date cannot be after end date.';
    } else {
        $stmt = $conn->prepare("UPDATE surveys SET title=?, description=?, start_date=?, end_date=?, status=? WHERE survey_id=?");
        $stmt->bind_param('sssssi', $title, $description, $start_date, $end_date, $status, $survey_id);
        $stmt->execute();
        $stmt->close();
        $message = 'Survey updated successfully.';
        $survey = array_merge($survey, compact('title', 'description', 'start_date', 'end_date', 'status'));
    }
}

require_once '../includes/header_staff.php';
?>
<?php // Same top-left return link the detail pages use, for consistency. ?>
<a class="back-link" href="survey_management.php">&larr; Back to Survey List</a>

<div class="card">
    <h2>Edit Survey</h2>
    <?php if ($message): ?><div class="alert alert-success"><?= h($message) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

    <form method="POST">
        <label for="title">Survey Title</label>
        <input type="text" id="title" name="title" required value="<?= h($survey['title']) ?>"
            placeholder="e.g. Community Health Assessment 2026">

        <label for="description">Description</label>
        <textarea id="description" name="description"><?= h($survey['description']) ?></textarea>

        <div class="grid-2">
            <div>
                <label for="start_date">Opening Date</label>
                <input type="date" id="start_date" name="start_date" required value="<?= h($survey['start_date']) ?>">
            </div>
            <div>
                <label for="end_date">Closing Date</label>
                <input type="date" id="end_date" name="end_date" required value="<?= h($survey['end_date']) ?>">
            </div>
        </div>

        <label for="status">Status</label>
        <select id="status" name="status">
            <option value="active" <?= $survey['status'] === 'active' ? 'selected' : '' ?>>Active</option>
            <option value="inactive" <?= $survey['status'] === 'inactive' ? 'selected' : '' ?>>Inactive</option>
        </select>

        <div class="form-actions">
            <button type="submit" class="btn">Save Changes</button>
            <a class="btn btn-secondary" href="question_management.php?survey_id=<?= $survey_id ?>">Manage Questions</a>
        </div>
    </form>
</div>
<?php require_once '../includes/footer.php'; ?>
