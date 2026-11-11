<?php
/** Staff survey transport. Business validation mirrors the four original pages. */
function api_management_input(): array {
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        if (in_array($type, ['', 'application/x-www-form-urlencoded', 'multipart/form-data'], true)) return $_POST;
        api_error('Unsupported request content type.', 415);
    }
    try { $value = json_decode(file_get_contents('php://input'), false, 512, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { api_error('Invalid JSON request.'); }
    if (!is_object($value)) api_error('The request body must be a JSON object.');
    return json_decode(json_encode($value), true);
}
function api_management_text(array $input, string $key, string $default = ''): string {
    $value = $input[$key] ?? $default;
    if (!is_string($value)) api_error('Invalid request field: ' . $key . '.');
    return $value;
}
function api_management_id(array $input, string $key): int {
    $value = $input[$key] ?? 0;
    if (!is_int($value) && !is_string($value)) api_error('Invalid request field: ' . $key . '.');
    return (int)$value;
}
function api_management_array(array $input, string $key): array {
    $value = $input[$key] ?? [];
    if (!is_array($value)) api_error('Invalid request field: ' . $key . '.');
    return $value;
}
function api_management_sql(mysqli $conn, string $sql, array $params = []): mysqli_stmt {
    $stmt = $conn->prepare($sql);
    if ($params) $stmt->bind_param(str_repeat('s', count($params)), ...$params);
    $stmt->execute();
    return $stmt;
}
function api_management_survey(mysqli $conn, int $id, bool $lock = false): array {
    $stmt = api_management_sql($conn, 'SELECT survey_id, title, description, start_date, end_date, status FROM surveys WHERE survey_id = ?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    $survey = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$survey) api_survey_destination('/staff/survey-management');
    return $survey;
}
function api_management_metadata(array $input): array {
    $title = trim(api_management_text($input, 'title'));
    $description = trim(api_management_text($input, 'description'));
    $start = api_management_text($input, 'start_date'); $end = api_management_text($input, 'end_date');
    if ($title === '' || $start === '' || $end === '') api_error('Title, start date, and end date are required.');
    if (!valid_written_text($title, 8)) api_error('Give the survey a real title - at least eight characters that describe what it is about.');
    if ($description !== '' && !valid_written_text($description, 10)) api_error('Either write a proper description of at least ten characters, or leave it blank.');
    if ($start > $end) api_error('Start date cannot be after end date.');
    return [$title, $description, $start, $end];
}
function api_management_type(array $input, string $key): string {
    $type = api_management_text($input, $key, 'short_answer');
    if (!in_array($type, ['multiple_choice', 'yesno', 'rating', 'short_answer'], true)) api_error('Invalid request field: ' . $key . '.');
    return $type;
}
function api_management_choices(array $input, string $key): array {
    $choices = api_management_array($input, $key);
    foreach ($choices as &$choice) {
        if (!is_string($choice)) api_error('Invalid request field: ' . $key . '.');
        $choice = trim($choice);
    }
    unset($choice);
    return $choices;
}
function api_management_insert_question(mysqli $conn, int $survey, string $text, string $type, int $order, array $choices): int {
    $stmt = api_management_sql($conn, 'INSERT INTO survey_questions (survey_id, question_text, question_type, question_order) VALUES (?, ?, ?, ?)', [$survey, $text, $type, $order]);
    $id = $stmt->insert_id; $stmt->close();
    if ($type === 'multiple_choice') foreach ($choices as $choice) {
        if ($choice !== '') api_management_sql($conn, 'INSERT INTO survey_choices (question_id, choice_text) VALUES (?, ?)', [$id, $choice])->close();
    }
    return $id;
}
function api_staff_surveys(mysqli $conn): void {
    $user = api_staff_user($conn);
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $rows = $conn->query('SELECT s.survey_id, s.title, s.start_date, s.end_date, s.status, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.survey_id) AS response_count FROM surveys s ORDER BY s.created_at DESC')->fetch_all(MYSQLI_ASSOC);
        api_json(['ok' => true, 'data' => ['surveys' => $rows, 'defaults' => ['start_date' => date('Y-m-d'), 'end_date' => date('Y-m-d', strtotime('+7 days'))]]]);
    }
    $input = api_management_input(); $metadata = api_management_metadata($input);
    $questions = [];
    foreach (api_management_array($input, 'questions') as $q) {
        if (!is_array($q)) api_error('Invalid request field: questions.');
        $text = trim(api_management_text($q, 'text'));
        if ($text !== '') $questions[] = [$text, api_management_type($q, 'type'), api_management_choices($q, 'choices')];
    }
    if (!$questions) api_error('Please add at least one question, and give it a question to ask.');
    $conn->begin_transaction();
    try {
        $stmt = api_management_sql($conn, "INSERT INTO surveys (title, description, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, 'active', ?)", [...$metadata, $user['id']]);
        $id = $stmt->insert_id; $stmt->close();
        foreach ($questions as $index => [$text, $type, $choices]) api_management_insert_question($conn, $id, $text, $type, $index + 1, $choices);
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback(); api_error('An error occurred while creating the survey.', 500);
    }
    api_json(['ok' => true, 'data' => ['survey_id' => $id], 'redirect' => '/staff/survey-management']);
}
function api_staff_survey(mysqli $conn, string $action): void {
    api_staff_user($conn);
    $input = $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : api_management_input();
    $id = api_management_id($input, 'id');
    if ($action === 'read') api_json(['ok' => true, 'data' => ['survey' => api_management_survey($conn, $id)]]);
    if ($action === 'update') {
        api_management_survey($conn, $id);
        $metadata = api_management_metadata($input); $status = api_management_text($input, 'status', 'active');
        if (!in_array($status, ['active', 'inactive'], true)) api_error('Invalid request field: status.');
        api_management_sql($conn, 'UPDATE surveys SET title=?, description=?, start_date=?, end_date=?, status=? WHERE survey_id=?', [...$metadata, $status, $id])->close();
        api_json(['ok' => true, 'data' => ['survey' => api_management_survey($conn, $id)], 'message' => 'Survey updated successfully.']);
    }
    if ($action === 'toggle') {
        api_management_sql($conn, "UPDATE surveys SET status = IF(status='active','inactive','active') WHERE survey_id = ?", [$id])->close();
        api_json(['ok' => true, 'data' => null, 'redirect' => '/staff/survey-management']);
    }
    if ($id <= 0) api_survey_destination('/staff/survey-management');
    $conn->begin_transaction();
    $stmt = api_management_sql($conn, 'SELECT title FROM surveys WHERE survey_id = ? FOR UPDATE', [$id]);
    $survey = $stmt->get_result()->fetch_assoc(); $stmt->close();
    $stmt = api_management_sql($conn, 'DELETE FROM surveys WHERE survey_id = ?', [$id]);
    $deleted = $stmt->affected_rows > 0; $stmt->close(); $conn->commit();
    if (!$deleted) api_error('The selected survey could not be found or deleted.');
    api_json(['ok' => true, 'data' => null, 'message' => 'Survey “' . ($survey['title'] ?? 'Survey') . '” was deleted successfully.', 'redirect' => '/staff/survey-management']);
}
