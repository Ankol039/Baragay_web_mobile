<?php
/** Question mutations serialize on the parent survey and invalidate answer metadata. */
function ss_mutate_question(string $sid, string $transaction, string $action, array $input): array {
    $questions = ss_questions($sid, $transaction);
    $qid = $action === 'questionCreate' ? '' : ss_id($input[$action === 'questionMove' ? 'qid' : 'question_id'] ?? '0');
    $owned = null;
    foreach ($questions as $q) if ($q['id'] === $qid) $owned = $q;
    $path = 'surveys/' . $sid . '/questions/' . $qid;
    $writes = [];
    if (in_array($action, ['questionCreate', 'questionUpdate'], true)) {
        if ($action === 'questionUpdate' && !$owned) api_error('That question does not belong to this survey.');
        $text = trim(api_management_text($input, 'question_text'));
        $type = api_management_type($input, 'question_type');
        $existing = $action === 'questionUpdate' ? api_management_choices($input, 'existing_choices') : [];
        $new = api_management_choices($input, $action === 'questionUpdate' ? 'new_choices' : 'choices');
        $ids = array_column($owned['choices'] ?? [], 'id');
        foreach ($existing as $id => $value) if (!in_array((string)$id, $ids, true)) api_error('Invalid request field: existing_choices.');
        if ($text === '') api_error('Question text is required.');
        if (!valid_written_text($text, 5)) api_error('Write the question out in words: at least five characters, and not one repeated character.');
        if ($type === 'multiple_choice' && count(array_filter([...array_values($existing), ...array_values($new)], fn($v) => $v !== '')) < 2)
            api_error('A multiple-choice question needs at least two choices. Blank boxes are ignored.');
        ss_text_bound($text, 255);
        if ($action === 'questionCreate') {
            $order = $questions ? max(array_column($questions, 'order')) + 1 : 1;
            [$qid, $writes] = ss_new_question($sid, $text, $type, $order, $new);
            $message = 'Question added.';
        } else {
            $writes[] = ss_write($path, ['text' => $text, 'type' => $type], true);
            foreach ($owned['choices'] as $choice) {
                $id = $choice['id'];
                if ($type !== 'multiple_choice' || (array_key_exists($id, $existing) && $existing[$id] === '')) $writes[] = ss_delete($path . '/choices/' . $id);
                elseif (array_key_exists($id, $existing)) {
                    ss_text_bound($existing[$id], 150);
                    // Update the text in place: answers still reference this exact ID.
                    $writes[] = ss_write($path . '/choices/' . $id, ['text' => $existing[$id]], true);
                }
            }
            $order = $owned['choices'] ? max(array_column($owned['choices'], 'order')) + 1 : 0;
            if ($type === 'multiple_choice') foreach ($new as $choice) if ($choice !== '') {
                ss_text_bound($choice, 150);
                $writes[] = ss_write($path . '/choices/' . bin2hex(random_bytes(16)), ['text' => $choice, 'order' => $order++, 'legacyId' => null]);
            }
            $message = 'Question updated.';
        }
    } elseif ($action === 'questionDelete') {
        if ($owned) {
            foreach ($owned['choices'] as $choice) $writes[] = ss_delete($path . '/choices/' . $choice['id']);
            $writes[] = ss_delete($path);
        }
        $order = 1;
        foreach ($questions as $q) if ($q['id'] !== $qid) $writes[] = ss_write('surveys/' . $sid . '/questions/' . $q['id'], ['order' => $order++], true);
        $message = 'Question deleted.';
    } else {
        $direction = api_management_text($input, 'move') === 'up' ? 'up' : 'down';
        if ($owned) {
            $candidates = array_values(array_filter($questions, fn($q) => $direction === 'up' ? $q['order'] < $owned['order'] : $q['order'] > $owned['order']));
            $other = $candidates ? ($direction === 'up' ? end($candidates) : $candidates[0]) : null;
            if ($other) {
                $writes[] = ss_write($path, ['order' => $other['order']], true);
                $writes[] = ss_write('surveys/' . $sid . '/questions/' . $other['id'], ['order' => $owned['order']], true);
            }
        }
        $message = 'Question order updated.';
    }
    // Even choice-only edits advance the same version used by submission transactions.
    $writes[] = ss_write('surveys/' . $sid, [], true, ['updatedAt']);
    return [$writes, ['question_id' => $qid, 'message' => $message]];
}
