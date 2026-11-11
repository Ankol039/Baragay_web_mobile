<?php
/** JSON boundary around the unchanged legacy database/session bootstrap. */
ini_set('display_errors', '0');
$api_buffer_level = ob_get_level();
ob_start();
$api_responded = false;

function api_json(array $body, int $status = 200): void {
    $GLOBALS['api_responded'] = true;
    while (ob_get_level() > $GLOBALS['api_buffer_level']) {
        ob_end_clean();
    }
    http_response_code($status);
    header_remove('Location');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function api_error(string $message, int $status = 400): void {
    api_json(['ok' => false, 'message' => $message], $status);
}

// db.php can exit with an HTML outage page. Discard it and keep this API JSON.
register_shutdown_function(function (): void {
    if (!$GLOBALS['api_responded']) {
        $status = http_response_code() === 503 ? 503 : 500;
        api_error('The system is temporarily unavailable. Please try again in a few minutes.', $status);
    }
});
set_exception_handler(function (Throwable $error): void {
    // Do not expose SQL, credentials, request bodies or filesystem paths.
    error_log('Authentication API failed (' . get_class($error) . ').');
    api_error('The system is temporarily unavailable. Please try again in a few minutes.', 500);
});
set_error_handler(function ($severity, $message, $file, $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

require_once __DIR__ . '/../../config/db.php';
// functions.php starts the existing PHP session; do not start a second one.
require_once __DIR__ . '/../../config/functions.php';

/** Accept the original form fields or a JSON object without coercing passwords. */
function api_input(array $fields): array {
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type === 'application/json') {
        try {
            $input = json_decode(file_get_contents('php://input'), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            api_error('Invalid JSON request.', 400);
        }
        if (!is_object($input)) {
            api_error('The request body must be a JSON object.', 400);
        }
        $input = (array)$input;
    } elseif ($type === '' || in_array($type, ['application/x-www-form-urlencoded', 'multipart/form-data'], true)) {
        $input = $_POST;
    } else {
        api_error('Unsupported request content type.', 415);
    }
    $values = [];
    foreach ($fields as $field) {
        $value = $input[$field] ?? '';
        if (!is_string($value)) {
            api_error('Invalid request field: ' . $field . '.', 400);
        }
        $values[$field] = $value;
    }
    return $values;
}
