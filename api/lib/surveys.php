<?php
/** Resident survey reads, preserving the original page predicates and ordering. */
function api_survey_query_id(string $key = 'id'): int {
    return is_scalar($_GET[$key] ?? null) ? (int)$_GET[$key] : 0;
}

function api_survey_row(mysqli $conn, int $id): ?array {
    return api_resident_rows($conn, 'SELECT * FROM surveys WHERE survey_id = ?', $id)[0] ?? null;
}

function api_survey_answered(mysqli $conn, int $survey_id, int $resident_id): bool {
    $stmt = $conn->prepare('SELECT 1 FROM responses WHERE survey_id = ? AND resident_id = ?');
    $stmt->bind_param('ii', $survey_id, $resident_id);
    $stmt->execute();
    $answered = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    return $answered;
}

function api_survey_destination(string $redirect = '/resident/surveys'): void {
    api_json(['ok' => true, 'data' => null, 'redirect' => $redirect]);
}

function api_resident_surveys(mysqli $conn): void {
    $resident_id = api_resident_id($conn);
    $surveys = api_resident_rows($conn, "
        SELECT s.survey_id, s.title, s.description, s.end_date,
            EXISTS(SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?) AS already_answered
        FROM surveys s
        WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
        ORDER BY s.start_date DESC", $resident_id);
    $open = []; $answered = [];
    foreach ($surveys as $survey) {
        $survey['end_date_label'] = date('M j, Y', strtotime($survey['end_date']));
        $survey['description_short'] = mb_strimwidth($survey['description'] ?? '', 0, 80, '...');
        if ($survey['already_answered']) { $answered[] = $survey; } else { $open[] = $survey; }
    }
    // Match surveys.php: this optional lookup supplies a title, not response access.
    $submitted = isset($_GET['submitted']) ? api_resident_rows($conn,
        'SELECT title FROM surveys WHERE survey_id = ?', api_survey_query_id('submitted'))[0] ?? null : null;
    api_json(['ok' => true, 'data' => ['open' => $open, 'answered' => $answered, 'submitted' => $submitted]]);
}

function api_resident_survey_form(mysqli $conn): void {
    $resident_id = api_resident_id($conn);
    $id = api_survey_query_id();
    $survey = api_survey_row($conn, $id);
    if (!$survey || !survey_is_open($survey) || api_survey_answered($conn, $id, $resident_id)) {
        api_survey_destination();
    }
    $questions = api_resident_rows($conn,
        'SELECT question_id, question_text, question_type, question_order FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC, question_id ASC', $id);
    foreach ($questions as &$question) {
        $question['choices'] = $question['question_type'] === 'multiple_choice' ? api_resident_rows($conn,
            'SELECT choice_id, choice_text FROM survey_choices WHERE question_id = ?', (int)$question['question_id']) : [];
    }
    unset($question);
    api_json(['ok' => true, 'data' => ['survey' => ['survey_id' => $id, 'title' => $survey['title'],
        'description' => $survey['description']], 'questions' => $questions]]);
}

function api_resident_confirmation(mysqli $conn): void {
    api_resident_id($conn);
    $survey = api_resident_rows($conn, 'SELECT title FROM surveys WHERE survey_id = ?', api_survey_query_id('survey_id'))[0] ?? null;
    api_json(['ok' => true, 'data' => ['title' => $survey['title'] ?? 'the survey']]);
}
