<?php
/** Use the unchanged PHP management validators and written-text policy. */
require_once __DIR__ . '/../../config/functions.php'; // Never db.php.
require_once __DIR__ . '/../lib/staff-surveys.php'; // Declarations only; no SQL handler is called.
class StaffSurveyInputError extends RuntimeException {}
function api_error(string $message, int $status = 400): void { throw new StaffSurveyInputError($message, $status); }
function ss_metadata(array $input): array {
    [$title, $description, $start, $end] = api_management_metadata($input);
    // MySQL column/date bounds remain enforced on the trusted writer.
    if (mb_strlen($title) > 150 || strlen($description) > 65535) api_error('Invalid request.');
    $dates = [];
    foreach ([$start, $end] as $date) {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '1000-01-01') api_error('Invalid request.');
        $dates[] = $parsed;
    }
    return ['title' => $title, 'description' => $description, 'startDate' => $dates[0], 'endDate' => $dates[1]];
}
function ss_text_bound(string $text, int $max): void { if (mb_strlen($text) > $max) api_error('Invalid request.'); }
function ss_new_question(string $sid, string $text, string $type, int $order, array $choices): array {
    ss_text_bound($text, 255);
    $id = bin2hex(random_bytes(16)); $path = 'surveys/' . $sid . '/questions/' . $id;
    $writes = [ss_write($path, ['text' => $text, 'type' => $type, 'order' => $order, 'legacyId' => null])];
    if ($type === 'multiple_choice') foreach (array_values(array_filter($choices, fn($s) => $s !== '')) as $i => $choice) {
        ss_text_bound($choice, 150);
        $writes[] = ss_write($path . '/choices/' . bin2hex(random_bytes(16)), ['text' => $choice, 'order' => $i, 'legacyId' => null]);
    }
    return [$id, $writes];
}
