<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$resident_id = (int)$_SESSION['resident_id'];
$response_id = (int)($_GET['id'] ?? 0);

$stmt = $conn->prepare("
    SELECT r.response_id, r.submitted_at, s.title
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
    http_response_code(404);
    exit('Response not found.');
}

$stmt = $conn->prepare("
    SELECT q.question_text, q.question_type, sr.choice_id, sr.rating_value, sr.answer_text, sc.choice_text
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
$result = $stmt->get_result();

$filename = 'survey-response-' . $response_id . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$out = fopen('php://output', 'w');
fputcsv($out, ['Survey', $response['title']]);
fputcsv($out, ['Submitted', date('Y-m-d H:i:s', strtotime($response['submitted_at']))]);
fputcsv($out, []);
fputcsv($out, ['Question', 'Answer']);

while ($row = $result->fetch_assoc()) {
    if ($row['question_type'] === 'multiple_choice') {
        $answer = $row['choice_text'] ?? '';
    } elseif ($row['question_type'] === 'rating') {
        $answer = $row['rating_value'] !== null ? $row['rating_value'] . ' / 5' : '';
    } else {
        $answer = $row['answer_text'] ?? '';
    }
    fputcsv($out, [$row['question_text'], $answer]);
}
fclose($out);
exit;
