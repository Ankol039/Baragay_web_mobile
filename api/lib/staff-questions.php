<?php
/** Question edits preserve choice IDs; all mutations serialize on the survey. */
function api_management_questions(mysqli $conn, int $survey): array {
    $rows = api_resident_rows($conn, 'SELECT question_id, question_text, question_type, question_order FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC, question_id ASC', $survey);
    foreach ($rows as &$row) $row['choices'] = $row['question_type'] === 'multiple_choice'
        ? api_resident_rows($conn, 'SELECT choice_id, choice_text FROM survey_choices WHERE question_id = ? ORDER BY choice_id ASC', (int)$row['question_id']) : [];
    unset($row); return $rows;
}
function api_management_resequence(mysqli $conn, int $survey): void {
    foreach (api_management_questions($conn, $survey) as $index => $q) {
        api_management_sql($conn, 'UPDATE survey_questions SET question_order = ? WHERE question_id = ?', [$index + 1, $q['question_id']])->close();
    }
}
function api_staff_questions(mysqli $conn, string $action): void {
    api_staff_user($conn);
    $input = $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : api_management_input();
    $survey_id = api_management_id($input, 'survey_id');
    if ($action === 'read') {
        $survey = api_management_survey($conn, $survey_id);
        api_json(['ok' => true, 'data' => ['survey' => $survey, 'questions' => api_management_questions($conn, $survey_id)]]);
    }
    $conn->begin_transaction(); api_management_survey($conn, $survey_id, true);
    $qid = api_management_id($input, $action === 'move' ? 'qid' : 'question_id');
    if ($action !== 'create') {
        $stmt = api_management_sql($conn, 'SELECT question_id, question_order FROM survey_questions WHERE question_id = ? AND survey_id = ?', [$qid, $survey_id]);
        $owned = $stmt->get_result()->fetch_all(MYSQLI_ASSOC); $stmt->close();
        if (!$owned && $action === 'update') api_error('That question does not belong to this survey.');
    }
    if ($action === 'create' || $action === 'update') {
        $text = trim(api_management_text($input, 'question_text'));
        $type = api_management_type($input, 'question_type');
        $existing = $action === 'update' ? api_management_choices($input, 'existing_choices') : [];
        $new = api_management_choices($input, $action === 'update' ? 'new_choices' : 'choices');
        // Count only owned choices, so IDs from another question cannot satisfy validation.
        if ($existing) {
            $ids = array_column(api_resident_rows($conn, 'SELECT choice_id FROM survey_choices WHERE question_id = ?', $qid), 'choice_id');
            foreach ($existing as $id => $value) if (!in_array((string)$id, array_map('strval', $ids), true)) api_error('Invalid request field: existing_choices.');
        }
        if ($text === '') api_error('Question text is required.');
        if (!valid_written_text($text, 5)) api_error('Write the question out in words: at least five characters, and not one repeated character.');
        if ($type === 'multiple_choice' && count(array_filter([...array_values($existing), ...array_values($new)], fn($v) => $v !== '')) < 2)
            api_error('A multiple-choice question needs at least two choices. Blank boxes are ignored.');
        if ($action === 'create') {
            $stmt = api_management_sql($conn, 'SELECT COALESCE(MAX(question_order),0)+1 AS next_order FROM survey_questions WHERE survey_id = ?', [$survey_id]);
            $order = (int)$stmt->get_result()->fetch_assoc()['next_order']; $stmt->close();
            $qid = api_management_insert_question($conn, $survey_id, $text, $type, $order, $new);
            $message = 'Question added.';
        } else {
            api_management_sql($conn, 'UPDATE survey_questions SET question_text = ?, question_type = ? WHERE question_id = ? AND survey_id = ?', [$text, $type, $qid, $survey_id])->close();
            if ($type === 'multiple_choice') {
                foreach ($existing as $id => $choice) {
                    if ($choice === '') api_management_sql($conn, 'DELETE FROM survey_choices WHERE choice_id = ? AND question_id = ?', [$id, $qid])->close();
                    else api_management_sql($conn, 'UPDATE survey_choices SET choice_text = ? WHERE choice_id = ? AND question_id = ?', [$choice, $id, $qid])->close();
                }
                foreach ($new as $choice) if ($choice !== '') api_management_sql($conn, 'INSERT INTO survey_choices (question_id, choice_text) VALUES (?, ?)', [$qid, $choice])->close();
            } else api_management_sql($conn, 'DELETE FROM survey_choices WHERE question_id = ?', [$qid])->close();
            $message = 'Question updated.';
        }
    } elseif ($action === 'delete') {
        api_management_sql($conn, 'DELETE FROM survey_questions WHERE question_id = ? AND survey_id = ?', [$qid, $survey_id])->close();
        api_management_resequence($conn, $survey_id); $message = 'Question deleted.';
    } else {
        $direction = api_management_text($input, 'move') === 'up' ? 'up' : 'down';
        if ($owned) {
            $row = $owned[0]; $comparison = $direction === 'up' ? '<' : '>'; $sort = $direction === 'up' ? 'DESC' : 'ASC';
            $stmt = api_management_sql($conn, "SELECT question_id, question_order FROM survey_questions WHERE survey_id = ? AND question_order $comparison ? ORDER BY question_order $sort LIMIT 1", [$survey_id, $row['question_order']]);
            $other = $stmt->get_result()->fetch_assoc(); $stmt->close();
            if ($other) {
                api_management_sql($conn, 'UPDATE survey_questions SET question_order = ? WHERE question_id = ?', [$other['question_order'], $qid])->close();
                api_management_sql($conn, 'UPDATE survey_questions SET question_order = ? WHERE question_id = ?', [$row['question_order'], $other['question_id']])->close();
            }
        }
        $message = 'Question order updated.';
    }
    $conn->commit();
    api_json(['ok' => true, 'data' => ['question_id' => $qid, 'questions' => api_management_questions($conn, $survey_id)], 'message' => $message]);
}
