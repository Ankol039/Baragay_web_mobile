<?php
function api_resident_history(mysqli $conn): void {
    $rows = api_resident_rows($conn, '
        SELECT r.response_id, r.survey_id, r.submitted_at, s.title, s.description
        FROM responses r INNER JOIN surveys s ON s.survey_id = r.survey_id
        WHERE r.resident_id = ? ORDER BY r.submitted_at DESC', api_resident_id($conn));
    foreach ($rows as &$row) {
        $row['submitted_at_label'] = date('M d, Y h:i A', strtotime($row['submitted_at']));
        $row['description_short'] = mb_strimwidth($row['description'] ?? '', 0, 90, '...');
    }
    unset($row);
    api_json(['ok' => true, 'data' => ['responses' => $rows]]);
}

function api_response_data(mysqli $conn, int $id, int $resident_id): ?array {
    $stmt = $conn->prepare('SELECT r.response_id, r.submitted_at, s.title, s.description
        FROM responses r INNER JOIN surveys s ON s.survey_id = r.survey_id
        WHERE r.response_id = ? AND r.resident_id = ? LIMIT 1');
    $stmt->bind_param('ii', $id, $resident_id);
    $stmt->execute();
    $response = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$response) { return null; }
    $stmt = $conn->prepare('SELECT q.question_id, q.question_text, q.question_type, q.question_order,
        sr.choice_id, sr.rating_value, sr.answer_text, sc.choice_text
        FROM survey_questions q
        LEFT JOIN survey_results sr ON sr.question_id = q.question_id AND sr.response_id = ?
        LEFT JOIN survey_choices sc ON sc.choice_id = sr.choice_id
        WHERE q.survey_id = (SELECT survey_id FROM responses WHERE response_id = ?)
        ORDER BY q.question_order ASC, q.question_id ASC');
    $stmt->bind_param('ii', $id, $id);
    $stmt->execute();
    $answers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return ['response' => $response, 'answers' => $answers];
}

function api_response_answer(array $row, string $empty = ''): string {
    if ($row['question_type'] === 'multiple_choice') { return $row['choice_text'] ?? $empty; }
    if ($row['question_type'] === 'rating') { return $row['rating_value'] !== null ? $row['rating_value'] . ' / 5' : $empty; }
    return $row['answer_text'] !== null && $row['answer_text'] !== '' ? $row['answer_text'] : $empty;
}

function api_resident_response(mysqli $conn, bool $export = false): void {
    $data = api_response_data($conn, api_survey_query_id(), api_resident_id($conn));
    if (!$data) {
        if (!$export) { api_survey_destination('/resident/history'); }
        api_response_csv_headers(404);
        echo 'Response not found.';
        exit;
    }
    if (!$export) {
        $data['response']['submitted_at_label'] = date('F d, Y h:i A', strtotime($data['response']['submitted_at']));
        foreach ($data['answers'] as &$answer) { $answer['display_answer'] = api_response_answer($answer, 'No answer'); }
        unset($answer);
        api_json(['ok' => true, 'data' => $data]);
    }
    // Generate completely before committing headers so failures still use the JSON boundary.
    $out = fopen('php://temp', 'w+');
    fputcsv($out, ['Survey', $data['response']['title']]);
    fputcsv($out, ['Submitted', date('Y-m-d H:i:s', strtotime($data['response']['submitted_at']))]);
    fputcsv($out, []);
    fputcsv($out, ['Question', 'Answer']);
    foreach ($data['answers'] as $answer) { fputcsv($out, [$answer['question_text'], api_response_answer($answer)]); }
    rewind($out);
    $csv = stream_get_contents($out);
    fclose($out);
    api_response_csv_headers();
    header('Content-Disposition: attachment; filename="survey-response-' . $data['response']['response_id'] . '.csv"');
    echo $csv;
    exit;
}

function api_response_csv_headers(int $status = 200): void {
    $GLOBALS['api_responded'] = true;
    while (ob_get_level() > $GLOBALS['api_buffer_level']) { ob_end_clean(); }
    http_response_code($status);
    header('Cache-Control: no-store');
    header('Content-Type: ' . ($status === 200 ? 'text/csv' : 'text/plain') . '; charset=utf-8');
}
