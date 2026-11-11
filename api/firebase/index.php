<?php
ini_set('display_errors', '0');
require_once __DIR__ . '/transport.php';
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    // Never log submitted passwords, tokens, upstream responses or server configuration.
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.', 503);
});
require_once __DIR__ . '/../../config/functions.php';
session_write_close(); // Reuse password policy only; this bridge never authenticates a PHP session.
require_once __DIR__ . '/auth.php';
$action = $_GET['action'] ?? '';
if ($action === 'rules' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $rules = [];
    foreach (password_rules() as $key => $rule) $rules[] = ['key' => $key, 'label' => $rule[0]];
    fb_reply(['ok' => true, 'data' => $rules]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fb_fail('Method not allowed.', 405);
// JSON-only + same-origin browser requests. No permissive CORS or cookie authentication.
if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') fb_fail('Unsupported request content type.', 415);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fb_fail('Access denied.', 403);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) fb_fail('Invalid request.', 413);
$raw = file_get_contents('php://input', false, null, 0, 32769);
if (strlen($raw) > 32768) fb_fail('Invalid request.', 413);
$input = json_decode($raw, true);
if (!is_array($input)) fb_fail('Invalid JSON request.', 400);
foreach ($input as $value) if (!is_string($value)) fb_fail('Invalid request.', 400);
switch ($action) {
    case 'resolve': fb_resolve($input); break;
    case 'profile': fb_profile($input); break;
    case 'login': case 'logout': fb_history($input, $action); break;
    case 'password': fb_password($input); break;
    default: fb_fail('Not found.', 404);
}
