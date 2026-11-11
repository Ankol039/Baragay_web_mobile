<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('surveys.php');
}

$resident_id = $_SESSION['resident_id'];
$survey_id = (int)($_POST['survey_id'] ?? 0);

$stmt = $conn->prepare("SELECT * FROM surveys WHERE survey_id = ?");
$stmt->bind_param('i', $survey_id);
$stmt->execute();
$survey = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$survey || !survey_is_open($survey)) {
    redirect('surveys.php');
}

// Already answered? A resident may only respond once.
$stmt = $conn->prepare("SELECT 1 FROM responses WHERE survey_id = ? AND resident_id = ?");
$stmt->bind_param('ii', $survey_id, $resident_id);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    redirect('surveys.php');
}
$stmt->close();

/* --------------------------------------------------------------------------
   Read the answers BEFORE opening a response row.

   A submission with nothing filled in used to be accepted: the response row
   was created, every question was skipped as "unanswered", and the survey
   moved to Already answered. The resident was then locked out of a survey
   they had never actually answered, and the empty response still counted
   towards the participation figures on the dashboard.

   The browser checks this too, but a page where scripting has not run — or
   has failed — must not be able to burn someone's single attempt. Nothing is
   written unless there is at least one real answer to write.
   -------------------------------------------------------------------------- */
$q_stmt = $conn->prepare("SELECT * FROM survey_questions WHERE survey_id = ?");
$q_stmt->bind_param('i', $survey_id);
$q_stmt->execute();
$questions = $q_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$q_stmt->close();

$answers = [];
foreach ($questions as $q) {
    $raw = $_POST['q' . $q['question_id']] ?? null;

    $choice_id = null;
    $rating_value = null;
    $answer_text = null;

    if ($q['question_type'] === 'multiple_choice' && $raw && strpos($raw, 'choice_') === 0) {
        $choice_id = (int)str_replace('choice_', '', $raw);
    } elseif ($q['question_type'] === 'yesno') {
        $answer_text = in_array($raw, ['Yes', 'No'], true) ? $raw : null;
    } elseif ($q['question_type'] === 'rating') {
        $rating = $raw !== null && $raw !== '' ? (int)$raw : null;
        $rating_value = ($rating !== null && $rating >= 1 && $rating <= 5) ? $rating : null;
    } else {
        $text = trim((string)($raw ?? ''));
        $answer_text = $text === '' ? null : $text;
    }

    if ($choice_id === null && $rating_value === null && $answer_text === null) {
        continue; // unanswered — an optional question, or simply left blank
    }

    $answers[] = [$q['question_id'], $choice_id, $rating_value, $answer_text];
}

if (empty($answers)) {
    redirect('survey_form.php?id=' . $survey_id . '&error=empty');
}

$conn->begin_transaction();
try {
    $stmt = $conn->prepare("INSERT INTO responses (survey_id, resident_id) VALUES (?, ?)");
    $stmt->bind_param('ii', $survey_id, $resident_id);
    $stmt->execute();
    $response_id = $conn->insert_id;
    $stmt->close();

    $insert = $conn->prepare("
        INSERT INTO survey_results (response_id, question_id, choice_id, rating_value, answer_text)
        VALUES (?, ?, ?, ?, ?)
    ");
    foreach ($answers as $a) {
        list($question_id, $choice_id, $rating_value, $answer_text) = $a;
        $insert->bind_param('iiiis', $response_id, $question_id, $choice_id, $rating_value, $answer_text);
        $insert->execute();
    }
    $insert->close();

    $conn->commit();
    redirect('surveys.php?submitted=' . $survey_id);
} catch (mysqli_sql_exception $e) {
    $conn->rollback();

    // 1062 is the unique key on (survey_id, resident_id) doing its job: a
    // second submission arrived while this one was still in flight. The
    // first one is recorded, so this is a success from where the resident
    // sits, not an error to alarm them with.
    if ($e->getCode() === 1062) {
        redirect('surveys.php');
    }

    error_log('Survey submission failed: ' . $e->getMessage());
    redirect('survey_form.php?id=' . $survey_id . '&error=failed');
} catch (Exception $e) {
    $conn->rollback();
    error_log('Survey submission failed: ' . $e->getMessage());
    redirect('survey_form.php?id=' . $survey_id . '&error=failed');
}
