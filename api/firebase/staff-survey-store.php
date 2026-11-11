<?php
/** Firestore-only transport shared by staff survey operations. */
class StaffSurveyRetry extends RuntimeException {}
function ss_id($value): string {
    if (!is_string($value) && !is_int($value)) api_error('Invalid request.');
    $value = (string)$value;
    if (!preg_match('/\A[A-Za-z0-9_-]{1,128}\z/', $value)) api_error('Invalid request.');
    return $value;
}
function ss_worker(?array $account): void {
    if (!$account || !in_array($account['role'] ?? '', ['staff', 'admin'], true)
        || empty($account['isActive']) || ($account['deletedAt'] ?? null) !== null
        || !empty($account['isFirstLogin']) || empty($account['profileCompleted'])) api_error('Access denied.', 403);
}
function ss_read(string $path, string $transaction): ?array {
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . ':batchGet', ['documents' => [fb_name($path)], 'transaction' => $transaction], $c['access']);
    if ($status === 409) throw new StaffSurveyRetry('Concurrent survey edit');
    if ($status !== 200) throw new RuntimeException('Firestore read failed');
    return isset($result[0]['found']) ? array_map('fb_decode', $result[0]['found']['fields'] ?? []) : null;
}
function ss_query(string $parent, string $collection, ?string $transaction = null, array $filter = [], int $limit = 0, array $select = []): array {
    $query = ['from' => [['collectionId' => $collection]]];
    if ($filter) $query['where'] = ['fieldFilter' => ['field' => ['fieldPath' => $filter[0]], 'op' => 'EQUAL', 'value' => fb_string($filter[1])]];
    if ($limit) $query['limit'] = $limit;
    if ($select) $query['select'] = ['fields' => array_map(fn($field) => ['fieldPath' => $field], $select)];
    $body = ['structuredQuery' => $query];
    if ($transaction) $body['transaction'] = $transaction;
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . ($parent ? '/' . $parent : '') . ':runQuery', $body, $c['access']);
    if ($status === 409) throw new StaffSurveyRetry('Concurrent survey edit');
    if ($status !== 200) throw new RuntimeException('Firestore query failed');
    $rows = [];
    foreach ($result as $item) if (isset($item['document'])) {
        $document = $item['document'];
        $rows[] = ['id' => basename($document['name']), ...array_map('fb_decode', $document['fields'] ?? [])];
    }
    return $rows;
}
function ss_encode($value): array {
    if ($value === null) return ['nullValue' => null];
    if (is_int($value)) return ['integerValue' => (string)$value];
    if ($value instanceof DateTimeInterface) return ['timestampValue' => $value->format('Y-m-d\TH:i:s\Z')];
    return fb_string($value);
}
function ss_write(string $path, array $data, bool $merge = false, array $timestamps = []): array {
    $write = ['update' => ['name' => fb_name($path), 'fields' => (object)array_map('ss_encode', $data)]];
    if ($merge) $write['updateMask'] = ['fieldPaths' => array_keys($data)];
    if ($timestamps) $write['updateTransforms'] = array_map(fn($key) => ['fieldPath' => $key, 'setToServerValue' => 'REQUEST_TIME'], $timestamps);
    return $write;
}
function ss_delete(string $path): array { return ['delete' => fb_name($path)]; }
function ss_transaction(string $uid, callable $work): array {
    $c = fb_config();
    for ($attempt = 0; $attempt < 5; $attempt++) {
        [$status, $begin] = fb_http($c['documents'] . ':beginTransaction', ['options' => ['readWrite' => (object)[]]], $c['access']);
        if ($status !== 200) throw new RuntimeException('Transaction unavailable');
        $transaction = $begin['transaction'];
        try {
            // Bind authorization to the same snapshot/commit as every mutation.
            ss_worker(fb_account_transaction($uid, $transaction));
            [$writes, $result] = $work($transaction);
            if (count($writes) > 500) api_error('The request could not be completed. Please try again.', 422);
            if (!$writes) {
                fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
                return $result;
            }
            [$status] = fb_http($c['documents'] . ':commit', ['transaction' => $transaction, 'writes' => $writes], $c['access']);
            if ($status === 409) throw new StaffSurveyRetry('Concurrent survey edit');
            if ($status !== 200) throw new RuntimeException('Firestore commit failed');
            return $result;
        } catch (Throwable $error) {
            fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
            if ($error instanceof StaffSurveyRetry) continue;
            throw $error;
        }
    }
    throw new RuntimeException('Survey changed; retry');
}
function ss_survey(string $sid, string $transaction, bool $deleting = false): ?array {
    $survey = ss_read('surveys/' . $sid, $transaction);
    if ($survey && !$deleting && ss_read('surveys/' . $sid . '/management/deletion', $transaction))
        api_error('The request could not be completed. Please try again.', 409);
    return $survey;
}
function ss_survey_row(string $id, array $survey): array {
    return ['survey_id' => $id, 'title' => $survey['title'], 'description' => $survey['description'] ?? '',
        'start_date' => substr($survey['startDate'], 0, 10), 'end_date' => substr($survey['endDate'], 0, 10), 'status' => $survey['status']];
}
function ss_questions(string $sid, ?string $transaction = null): array {
    $questions = ss_query('surveys/' . $sid, 'questions', $transaction);
    usort($questions, fn($a, $b) => ($a['order'] <=> $b['order']) ?: (($a['legacyId'] ?? PHP_INT_MAX) <=> ($b['legacyId'] ?? PHP_INT_MAX)) ?: strcmp($a['id'], $b['id']));
    foreach ($questions as &$q) {
        $q['choices'] = ss_query('surveys/' . $sid . '/questions/' . $q['id'], 'choices', $transaction);
        usort($q['choices'], fn($a, $b) => ($a['order'] <=> $b['order']) ?: strcmp($a['id'], $b['id']));
    }
    unset($q);
    return $questions;
}
function ss_question_rows(array $questions): array {
    return array_map(fn($q) => ['question_id' => $q['id'], 'question_text' => $q['text'], 'question_type' => $q['type'], 'question_order' => $q['order'],
        'choices' => $q['type'] === 'multiple_choice' ? array_map(fn($c) => ['choice_id' => $c['id'], 'choice_text' => $c['text']], $q['choices']) : []], $questions);
}
