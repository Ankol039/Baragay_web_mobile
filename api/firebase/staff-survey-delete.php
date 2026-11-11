<?php
/** Resumable, bounded cascade. Keep all parents until their descendants are gone. */
function ss_delete_batch(string $uid, string $sid, array $writes): void {
    if (!$writes) return;
    ss_transaction($uid, function ($transaction) use ($sid, $writes) {
        $survey = ss_survey($sid, $transaction, true);
        if (!$survey || $survey['status'] !== 'inactive' || !ss_read('surveys/' . $sid . '/management/deletion', $transaction))
            api_error('The request could not be completed. Please try again.', 409);
        return [$writes, []];
    });
}
function ss_clear_collection(string $uid, string $sid, string $parent, string $collection): void {
    while ($rows = ss_query($parent, $collection, null, [], 400)) {
        ss_delete_batch($uid, $sid, array_map(fn($row) => ss_delete($parent . '/' . $collection . '/' . $row['id']), $rows));
    }
}
function ss_delete_survey(string $uid, string $sid): array {
    $survey = ss_transaction($uid, function ($transaction) use ($sid) {
        $survey = ss_survey($sid, $transaction, true);
        if (!$survey) api_error('The selected survey could not be found or deleted.');
        $marker = ss_read('surveys/' . $sid . '/management/deletion', $transaction);
        if ($marker) return [[], $survey];
        // Residents cannot submit once this commit closes the survey. Other bridge
        // edits read the marker and cannot reopen it halfway through a cascade.
        return [[ss_write('surveys/' . $sid, ['status' => 'inactive'], true, ['updatedAt']),
            ss_write('surveys/' . $sid . '/management/deletion', ['title' => $survey['title']], false, ['startedAt'])], $survey];
    });
    while ($responses = ss_query('', 'responses', null, ['surveyId', $sid], 400)) {
        foreach ($responses as $response) ss_clear_collection($uid, $sid, 'responses/' . $response['id'], 'answers');
        ss_delete_batch($uid, $sid, array_map(fn($r) => ss_delete('responses/' . $r['id']), $responses));
    }
    while ($questions = ss_query('surveys/' . $sid, 'questions', null, [], 400)) {
        foreach ($questions as $question) ss_clear_collection($uid, $sid, 'surveys/' . $sid . '/questions/' . $question['id'], 'choices');
        ss_delete_batch($uid, $sid, array_map(fn($q) => ss_delete('surveys/' . $sid . '/questions/' . $q['id']), $questions));
    }
    ss_clear_collection($uid, $sid, 'surveys/' . $sid, 'validation');
    ss_delete_batch($uid, $sid, [ss_delete('surveys/' . $sid . '/management/deletion'), ss_delete('surveys/' . $sid)]);
    return ['ok' => true, 'data' => null, 'message' => 'Survey “' . $survey['title'] . '” was deleted successfully.', 'redirect' => '/staff/survey-management'];
}
