<?php
/** Standalone React/Firebase runtime. Only public build assets and named APIs. */
$root = dirname(__DIR__, 2);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$prefix = '/barangay_survey_system/app';
if ($path === $prefix || str_starts_with($path, $prefix . '/')) $path = substr($path, strlen($prefix)) ?: '/';

function runtime_stop(int $status): void {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $status === 405 ? 'Method not allowed.' : 'Not found.';
    exit;
}

if (preg_match('/[\x00-\x1f\\\\%]/', $path) || in_array('..', explode('/', $path), true)) runtime_stop(404);
$endpoints = [
    '/firebase-auth.php' => 'index.php',
    '/firebase-resident.php' => 'resident-read.php',
    '/firebase-survey.php' => 'survey-schema.php',
    '/firebase-profile.php' => 'resident-profile.php',
    '/firebase-staff-surveys.php' => 'staff-surveys.php',
    '/firebase-staff-reports.php' => 'staff-reports.php',
    '/firebase-accounts.php' => 'accounts.php',
];
foreach (array_unique(array_values($endpoints)) as $file) $endpoints['/api/firebase/' . $file] = $file;
if (isset($endpoints[$path])) {
    if (!is_file(__DIR__ . '/' . $endpoints[$path])) runtime_stop(404);
    require __DIR__ . '/' . $endpoints[$path];
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) runtime_stop(405);
$dist = realpath(getenv('BSS_FRONTEND_DIST') ?: $root . '/frontend/dist');
if (!$dist) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Build the React application first.');
}
$types = ['html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8', 'png' => 'image/png', 'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon',
    'woff' => 'font/woff', 'woff2' => 'font/woff2'];
$file = realpath($dist . $path);
if (!$file || !is_file($file) || !str_starts_with($file, $dist . DIRECTORY_SEPARATOR)) {
    // Only React route shapes receive the SPA fallback; unknown files/APIs stay 404.
    if (!preg_match('~^/(?:|index\.html|login|landing|admin|(?:resident|staff)/[a-z-]+)$~', $path)) runtime_stop(404);
    $file = $dist . '/index.html';
}
$extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if (!isset($types[$extension])) runtime_stop(404);
header('Content-Type: ' . $types[$extension]);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($file);
