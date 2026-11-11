<?php
/** Trusted required-question metadata only. Response writes stay in the SDK transaction. */
ini_set('display_errors', '0');
require_once __DIR__ . '/transport.php';
require_once __DIR__ . '/auth.php';
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.', 503);
});
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
$sid = $input['surveyId'] ?? '';
if (!preg_match('/\A[A-Za-z0-9-]{1,128}\z/', $sid)) fb_reply(['ok' => true, 'data' => null]);
$c = fb_config();
for ($attempt = 0; $attempt < 4; $attempt++) {
    [$status, $begin] = fb_http($c['documents'] . ':beginTransaction', ['options' => ['readWrite' => (object)[]]], $c['access']);
    if ($status !== 200) throw new RuntimeException('Transaction unavailable');
    $transaction = $begin['transaction'];
    try {
        $current = fb_account_transaction($identity['localId'], $transaction);
        if ($current['role'] !== 'resident' || $current['isFirstLogin'] || !$current['profileCompleted'])
            throw new FirebaseBoundaryError('Access denied.', 403);
        [$status, $batch] = fb_http($c['documents'] . ':batchGet',
            ['documents' => [fb_name('surveys/' . $sid)], 'transaction' => $transaction], $c['access']);
        if ($status !== 200) throw new RuntimeException('Survey unavailable');
        $survey = $batch[0]['found'] ?? null;
        $day = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
        $fields = $survey['fields'] ?? [];
        if (($status === 200 && !$survey) || ($fields['status']['stringValue'] ?? '') !== 'active'
            || substr($fields['startDate']['timestampValue'] ?? '', 0, 10) > $day
            || substr($fields['endDate']['timestampValue'] ?? '', 0, 10) < $day) {
            fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
            fb_reply(['ok' => true, 'data' => null]);
        }
        if (!isset($fields['updatedAt'])) throw new RuntimeException('Survey unavailable');
        [$status, $result] = fb_http($c['documents'] . '/surveys/' . $sid . ':runQuery',
            ['transaction' => $transaction, 'structuredQuery' => ['from' => [['collectionId' => 'questions']]]], $c['access']);
        if ($status !== 200) throw new RuntimeException('Questions unavailable');
        $required = [];
        foreach ($result as $row) if (isset($row['document'])) {
            $q = $row['document'];
            $id = basename($q['name']);
            if (!preg_match('/\A[A-Za-z0-9_-]{1,128}\z/', $id)) throw new RuntimeException('Invalid question ID');
            $f = $q['fields'];
            if ($f['required']['booleanValue'] ?? ($f['type']['stringValue'] !== 'short_answer')) $required[] = $id;
        }
        sort($required, SORT_STRING);
        $next = [];
        foreach ($required as $i => $id) $next[$id] = fb_string($required[$i + 1] ?? '');
        // A linked proof avoids an arbitrary fixed limit/unrolled list in Rules.
        $schema = ['surveyVersion' => $fields['updatedAt'], 'firstRequiredId' => fb_string($required[0] ?? ''),
            'requiredNext' => ['mapValue' => ['fields' => (object)$next]]];
        [$status] = fb_http($c['documents'] . ':commit', ['transaction' => $transaction, 'writes' => [
            ['update' => ['name' => fb_name('surveys/' . $sid . '/validation/response'), 'fields' => $schema]]]], $c['access']);
        if ($status === 409) continue;
        if ($status !== 200) throw new RuntimeException('Schema unavailable');
        fb_reply(['ok' => true, 'data' => ['ready' => true]]);
    } catch (Throwable $error) {
        fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
        throw $error;
    }
}
throw new RuntimeException('Survey changed; retry');
