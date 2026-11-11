<?php
/** CLI-only PHP/MySQL read oracle. Never includes the self-healing db.php. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../config/functions.php';
session_write_close();
date_default_timezone_set('Asia/Manila');
class ResidentReadResult extends Exception { public array $body; public function __construct(array $body) { $this->body = $body; } }
function api_json(array $body): void { throw new ResidentReadResult($body); }
function api_current_user(mysqli $conn, bool $required = false): array { return ['account_type' => 'resident']; }
function api_error(string $message, int $status): void { throw new RuntimeException('Reference refused'); }
require_once __DIR__ . '/../../api/lib/resident.php';
require_once __DIR__ . '/../../api/lib/surveys.php';
require_once __DIR__ . '/../../api/lib/survey-responses.php';
function capture_read(callable $callback): array {
    try { $callback(); } catch (ResidentReadResult $result) { return $result->body; }
    throw new RuntimeException('Missing reference result');
}
try {
    $conn = new mysqli(getenv('BSS_TEST_HOST'), getenv('BSS_TEST_USER'), getenv('BSS_TEST_PASSWORD'), getenv('BSS_TEST_DATABASE'), (int)getenv('BSS_TEST_PORT'));
    $conn->set_charset('utf8mb4');
    $conn->query("SET time_zone = '+08:00'");
    $conn->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $conn->query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    $residents = $conn->query('SELECT resident_id, first_name, last_name FROM residents WHERE deleted_at IS NULL AND is_active = 1')->fetch_all(MYSQLI_ASSOC);
    $out = [];
    foreach ($residents as $resident) {
        $_SESSION['resident_id'] = (int)$resident['resident_id'];
        $_SESSION['resident_name'] = trim($resident['first_name'] . ' ' . $resident['last_name']);
        $_GET = [];
        $row = ['id' => $_SESSION['resident_id'], 'dashboard' => capture_read(fn() => api_resident_dashboard($conn)),
            'surveys' => capture_read(fn() => api_resident_surveys($conn)), 'history' => capture_read(fn() => api_resident_history($conn))];
        foreach (['available', 'completed', 'assigned'] as $view) {
            $_GET = ['view' => $view];
            $row[$view] = capture_read(fn() => api_resident_stat_detail($conn));
        }
        $row['responses'] = [];
        $row['csv'] = [];
        foreach ($row['history']['data']['responses'] as $response) {
            $_GET = ['id' => $response['response_id']];
            $row['responses'][(string)$response['response_id']] = capture_read(fn() => api_resident_response($conn));
            $data = api_response_data($conn, (int)$response['response_id'], $_SESSION['resident_id']);
            $csv = fopen('php://temp', 'w+');
            fputcsv($csv, ['Survey', $data['response']['title']]);
            fputcsv($csv, ['Submitted', date('Y-m-d H:i:s', strtotime($data['response']['submitted_at']))]);
            fputcsv($csv, []);
            fputcsv($csv, ['Question', 'Answer']);
            foreach ($data['answers'] as $answer) fputcsv($csv, [$answer['question_text'], api_response_answer($answer)]);
            rewind($csv);
            $row['csv'][(string)$response['response_id']] = stream_get_contents($csv);
            fclose($csv);
        }
        $out[] = $row;
    }
    $conn->rollback();
    $conn->close();
    echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $error) { fwrite(STDERR, "Read-only reference failed.\n"); exit(1); }
