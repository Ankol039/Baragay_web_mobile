<?php
/** Firestore-only metadata joins for the resident service; no SQL bootstrap. */
ini_set('display_errors', '0');
require_once __DIR__ . '/transport.php';
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.', 503);
});
require_once __DIR__ . '/auth.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fb_fail('Method not allowed.', 405);
if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') fb_fail('Unsupported request content type.', 415);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fb_fail('Access denied.', 403);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) fb_fail('Invalid request.', 413);
$raw = file_get_contents('php://input', false, null, 0, 32769);
if (strlen($raw) > 32768) fb_fail('Invalid request.', 413);
$input = json_decode($raw, true);
if (!is_array($input)) fb_fail('Invalid JSON request.', 400);
foreach ($input as $value) if (!is_string($value)) fb_fail('Invalid request.', 400);
[$identity, $account] = fb_verified($input);
fb_account($account);
if ($account['role'] !== 'resident' || $account['isFirstLogin'] || !$account['profileCompleted']) fb_fail('Access denied.', 403);
$uid = $identity['localId']; // Never trust an owner UID, role or resident ID from input.

function resident_query(string $parent, string $collection, array $filters = []): array {
    $query = ['from' => [['collectionId' => $collection]]];
    if ($filters) $query['where'] = count($filters) === 1 ? $filters[0] : ['compositeFilter' => ['op' => 'AND', 'filters' => $filters]];
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . ($parent === '' ? '' : '/' . $parent) . ':runQuery', ['structuredQuery' => $query], $c['access']);
    if ($status !== 200) throw new RuntimeException('Firestore unavailable');
    $rows = [];
    foreach ($result as $item) if (isset($item['document'])) {
        $doc = $item['document'];
        $rows[] = ['id' => rawurldecode(basename($doc['name'])), ...array_map('fb_decode', $doc['fields'] ?? [])];
    }
    return $rows;
}
function resident_filter(string $field, string $value): array {
    return ['fieldFilter' => ['field' => ['fieldPath' => $field], 'op' => 'EQUAL', 'value' => fb_string($value)]];
}
function resident_id(string $id): string {
    if (!preg_match('/\A[A-Za-z0-9_-]{1,300}\z/', $id)) fb_fail('Invalid request.', 400);
    return rawurlencode($id);
}
function resident_metadata(array $response): ?array {
    $survey = fb_document('surveys/' . resident_id($response['surveyId']));
    return $survey ? ['id' => $response['surveyId'], 'title' => $survey['title'], 'description' => $survey['description'],
        'description_short' => mb_strimwidth($survey['description'] ?? '', 0, 90, '...')] : null;
}
switch ($input['action'] ?? '') {
    case 'history':
        $surveys = [];
        foreach (resident_query('', 'responses', [resident_filter('residentUid', $uid)]) as $response) {
            if (!array_key_exists($response['surveyId'], $surveys)) $surveys[$response['surveyId']] = resident_metadata($response);
        }
        fb_reply(['ok' => true, 'data' => ['surveys' => (object)$surveys]]);
        break;
    case 'response':
        $id = resident_id($input['responseId'] ?? '');
        $response = fb_document('responses/' . $id);
        if (!$response || $response['residentUid'] !== $uid) fb_reply(['ok' => true, 'data' => null]);
        $survey = resident_metadata($response);
        if (!$survey) fb_reply(['ok' => true, 'data' => null]);
        $questions = resident_query('surveys/' . resident_id($response['surveyId']), 'questions');
        foreach ($questions as &$question) {
            $question['choices'] = $question['type'] === 'multiple_choice'
                ? resident_query('surveys/' . resident_id($response['surveyId']) . '/questions/' . resident_id($question['id']), 'choices') : [];
        }
        unset($question);
        fb_reply(['ok' => true, 'data' => ['survey' => $survey, 'questions' => $questions]]);
        break;
    case 'submitted':
        // Original PHP exposes only this title for the optional confirmation banner.
        $survey = fb_document('surveys/' . resident_id($input['surveyId'] ?? ''));
        fb_reply(['ok' => true, 'data' => $survey ? ['title' => $survey['title']] : null]);
        break;
    default: fb_fail('Not found.', 404);
}
