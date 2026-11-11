<?php
/** Transaction and answer conversion from resident/submit.php. */
function api_resident_survey_submit(mysqli $conn): void {
    $resident_id = api_resident_id($conn);
    $survey_id = (int)api_input(['survey_id'])['survey_id'];
    $survey = api_survey_row($conn, $survey_id);
    if (!$survey || !survey_is_open($survey) || api_survey_answered($conn, $survey_id, $resident_id)) {
        api_survey_destination();
    }
    $questions = api_resident_rows($conn, 'SELECT * FROM survey_questions WHERE survey_id = ?', $survey_id);
    $input = api_input(array_map(fn($q) => 'q' . $q['question_id'], $questions));
    $answers = [];
    foreach ($questions as $q) {
        $raw = $input['q' . $q['question_id']];
        $choice_id = null; $rating_value = null; $answer_text = null;
        if ($q['question_type'] === 'multiple_choice' && $raw && strpos($raw, 'choice_') === 0) {
            $choice_id = (int)str_replace('choice_', '', $raw);
        } elseif ($q['question_type'] === 'yesno') {
            $answer_text = in_array($raw, ['Yes', 'No'], true) ? $raw : null;
        } elseif ($q['question_type'] === 'rating') {
            $rating = $raw !== '' ? (int)$raw : null;
            $rating_value = ($rating !== null && $rating >= 1 && $rating <= 5) ? $rating : null;
        } else {
            $text = trim($raw);
            $answer_text = $text === '' ? null : $text;
        }
        if ($choice_id === null && $rating_value === null && $answer_text === null) { continue; }
        $answers[] = [$q['question_id'], $choice_id, $rating_value, $answer_text];
    }
    if (!$answers) { api_survey_destination('/resident/survey-form?id=' . $survey_id . '&error=empty'); }
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare('INSERT INTO responses (survey_id, resident_id) VALUES (?, ?)');
        $stmt->bind_param('ii', $survey_id, $resident_id);
        $stmt->execute();
        $response_id = $conn->insert_id;
        $stmt->close();
        $insert = $conn->prepare('INSERT INTO survey_results (response_id, question_id, choice_id, rating_value, answer_text) VALUES (?, ?, ?, ?, ?)');
        foreach ($answers as $a) {
            [$question_id, $choice_id, $rating_value, $answer_text] = $a;
            $insert->bind_param('iiiis', $response_id, $question_id, $choice_id, $rating_value, $answer_text);
            $insert->execute();
        }
        $insert->close();
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        // A concurrent winning submission is already recorded: return to the list quietly.
        if ($error instanceof mysqli_sql_exception && $error->getCode() === 1062) { api_survey_destination(); }
        error_log('Survey submission failed (' . get_class($error) . ').');
        api_survey_destination('/resident/survey-form?id=' . $survey_id . '&error=failed');
    }
    api_survey_destination('/resident/surveys?submitted=' . $survey_id);
}
