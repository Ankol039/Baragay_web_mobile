<?php
/** Source CSV queries and rows, buffered before sending the attachment. */
function api_staff_report_export(mysqli $conn): void {
api_staff_user($conn);
$survey_id = api_report_survey_id();
$stmt = $conn->prepare("SELECT * FROM surveys WHERE survey_id = ?");
$stmt->bind_param('i', $survey_id);
$stmt->execute();
$survey = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$survey) {
    api_response_csv_headers(302);
    header('Location: ' . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/') . '/app/staff/reports');
    exit;
}

$filename = 'survey_report_' . preg_replace('/[^A-Za-z0-9_-]/', '_', $survey['title']) . '.csv';


$out = fopen('php://temp', 'w+');
fputcsv($out, ['Barangay Health Center - Survey Report']);
fputcsv($out, ['Survey Title', $survey['title']]);
fputcsv($out, ['Period', $survey['start_date'] . ' to ' . $survey['end_date']]);
fputcsv($out, []);

$q_result = $conn->query("SELECT * FROM survey_questions WHERE survey_id = $survey_id ORDER BY question_order ASC");
while ($q = $q_result->fetch_assoc()) {
    fputcsv($out, ['Question', $q['question_text']]);
    fputcsv($out, ['Option', 'Count']);

    $qid = $q['question_id'];
    if ($q['question_type'] === 'multiple_choice') {
        $stmt = $conn->prepare("
            SELECT c.choice_text, COUNT(sr.answer_id) AS votes
            FROM survey_choices c LEFT JOIN survey_results sr ON sr.choice_id = c.choice_id
            WHERE c.question_id = ? GROUP BY c.choice_id, c.choice_text
        ");
        $stmt->bind_param('i', $qid);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        foreach ($rows as $r) fputcsv($out, [$r['choice_text'], $r['votes']]);

    } elseif ($q['question_type'] === 'yesno') {
        $stmt = $conn->prepare("SELECT answer_text, COUNT(*) AS votes FROM survey_results WHERE question_id = ? AND answer_text IN ('Yes','No') GROUP BY answer_text");
        $stmt->bind_param('i', $qid);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        foreach ($rows as $r) fputcsv($out, [$r['answer_text'], $r['votes']]);

    } elseif ($q['question_type'] === 'rating') {
        $stmt = $conn->prepare("SELECT rating_value, COUNT(*) AS votes FROM survey_results WHERE question_id = ? AND rating_value IS NOT NULL GROUP BY rating_value ORDER BY rating_value");
        $stmt->bind_param('i', $qid);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        foreach ($rows as $r) fputcsv($out, [$r['rating_value'] . ' star(s)', $r['votes']]);

    } else {
        $stmt = $conn->prepare("SELECT answer_text FROM survey_results WHERE question_id = ? AND answer_text IS NOT NULL AND answer_text != ''");
        $stmt->bind_param('i', $qid);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        foreach ($rows as $r) fputcsv($out, ['Response', $r['answer_text']]);
    }
    fputcsv($out, []);
}

rewind($out);
$csv = stream_get_contents($out);
fclose($out);
api_response_csv_headers();
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="' . $filename . '"');
echo $csv;
exit;

}
