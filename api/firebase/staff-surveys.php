<?php
/** Verified staff/admin survey management. No legacy session or MySQL access. */
ini_set('display_errors', '0');
require_once __DIR__ . '/transport.php';
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    if ($error instanceof StaffSurveyInputError) fb_fail($error->getMessage(), $error->getCode() ?: 400);
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.', 503);
});
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/staff-survey-policy.php';
require_once __DIR__ . '/staff-survey-store.php';
require_once __DIR__ . '/staff-survey-questions.php';
require_once __DIR__ . '/staff-survey-delete.php';
date_default_timezone_set('Asia/Manila');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fb_fail('Method not allowed.', 405);
if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') fb_fail('Unsupported request content type.', 415);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fb_fail('Access denied.', 403);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) fb_fail('Invalid request.', 413);
$raw = file_get_contents('php://input', false, null, 0, 1048577);
if (strlen($raw) > 1048576) fb_fail('Invalid request.', 413);
if (!is_object(json_decode($raw))) fb_fail('Invalid JSON request.', 400);
$input = json_decode($raw, true);
if (!is_string($input['idToken'] ?? null) || !is_string($input['action'] ?? null)) fb_fail('Invalid request.', 400);
[$identity, $account] = fb_verified($input);
ss_worker($account);
$uid = ss_id($identity['localId']); $action = $input['action'];
$actions = ['list', 'get', 'create', 'update', 'toggle', 'delete', 'questions', 'questionCreate', 'questionUpdate', 'questionDelete', 'questionMove'];
if (!in_array($action, $actions, true)) fb_fail('Not found.', 404);
if ($action === 'list') {
    $surveys = ss_query('', 'surveys');
    usort($surveys, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']) ?: strcmp($a['id'], $b['id']));
    $counts = array_count_values(array_column(ss_query('', 'responses', null, [], 0, ['surveyId']), 'surveyId'));
    fb_reply(['ok' => true, 'data' => ['surveys' => array_map(fn($s) => ss_survey_row($s['id'], $s) + ['response_count' => $counts[$s['id']] ?? 0], $surveys),
        'defaults' => ['start_date' => date('Y-m-d'), 'end_date' => date('Y-m-d', strtotime('+7 days'))]]]);
}
$sid = $action === 'create' ? bin2hex(random_bytes(16)) : ss_id($input[str_starts_with($action, 'question') ? 'survey_id' : 'id'] ?? '0');
if ($action === 'delete') fb_reply(ss_delete_survey($uid, $sid));
$result = ss_transaction($uid, function ($transaction) use ($action, $input, $uid, $sid) {
    $survey = $action === 'create' ? null : ss_survey($sid, $transaction);
    if (!$survey && $action !== 'create') return [[], ['ok' => true, 'data' => null, 'redirect' => '/staff/survey-management']];
    if ($action === 'get' || $action === 'questions') return [[], ['ok' => true, 'data' => ['survey' => ss_survey_row($sid, $survey)]
        + ($action === 'questions' ? ['questions' => ss_question_rows(ss_questions($sid, $transaction))] : [])]];
    if (str_starts_with($action, 'question')) {
        [$writes, $data] = ss_mutate_question($sid, $transaction, $action, $input);
        return [$writes, ['ok' => true, 'data' => ['question_id' => $data['question_id']], 'message' => $data['message']]];
    }
    if ($action === 'toggle') return [[ss_write('surveys/' . $sid, ['status' => $survey['status'] === 'active' ? 'inactive' : 'active'], true, ['updatedAt'])],
        ['ok' => true, 'data' => null, 'redirect' => '/staff/survey-management']];
    $metadata = ss_metadata($input);
    if ($action === 'update') {
        $status = api_management_text($input, 'status', 'active');
        if (!in_array($status, ['active', 'inactive'], true)) api_error('Invalid request field: status.');
        return [[ss_write('surveys/' . $sid, $metadata + ['status' => $status], true, ['updatedAt'])],
            ['ok' => true, 'data' => ['survey' => ss_survey_row($sid, array_merge($survey, $metadata, ['startDate' => $metadata['startDate']->format('Y-m-d'), 'endDate' => $metadata['endDate']->format('Y-m-d'), 'status' => $status]))], 'message' => 'Survey updated successfully.']];
    }
    $writes = [ss_write('surveys/' . $sid, $metadata + ['status' => 'active', 'createdByUid' => $uid, 'legacyId' => null], false, ['createdAt', 'updatedAt'])];
    $order = 0;
    foreach (api_management_array($input, 'questions') as $q) {
        if (!is_array($q)) api_error('Invalid request field: questions.');
        $text = trim(api_management_text($q, 'text'));
        if ($text === '') continue;
        [, $questionWrites] = ss_new_question($sid, $text, api_management_type($q, 'type'), ++$order, api_management_choices($q, 'choices'));
        array_push($writes, ...$questionWrites);
    }
    if (!$order) api_error('Please add at least one question, and give it a question to ask.');
    return [$writes, ['ok' => true, 'data' => ['survey_id' => $sid], 'redirect' => '/staff/survey-management']];
});
if (str_starts_with($action, 'question') && $action !== 'questions' && !isset($result['redirect'])) $result['data']['questions'] = ss_question_rows(ss_questions($sid));
fb_reply($result);
