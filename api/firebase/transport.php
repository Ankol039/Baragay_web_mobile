<?php
/** Standalone Firebase REST boundary. Never loads db.php or a private key. */
function fb_reply(array $body, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function fb_fail(string $message, int $status = 400): void {
    fb_reply(['ok' => false, 'message' => $message], $status);
}
function fb_config(): array {
    static $config;
    if ($config) return $config;
    $project = json_decode(file_get_contents(__DIR__ . '/../../.firebaserc'), true)['projects']['default'];
    $local = getenv('BSS_USE_EMULATORS') === 'true';
    if ($local) {
        // Explicit server mode, never inferred from a browser field or header.
        if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) fb_fail('Access denied.', 403);
        $auth = getenv('FIREBASE_AUTH_EMULATOR_HOST');
        $store = getenv('FIRESTORE_EMULATOR_HOST');
        if ($auth !== '127.0.0.1:9099' || $store !== '127.0.0.1:8080') throw new RuntimeException('Local config');
        $authBase = "http://$auth/identitytoolkit.googleapis.com/v1";
        $storeBase = "http://$store/v1";
        $access = 'owner';
        $key = 'emulator-only';
    } else {
        $authBase = 'https://identitytoolkit.googleapis.com/v1';
        $storeBase = 'https://firestore.googleapis.com/v1';
        // Short-lived OAuth token injected by the host; never a service account file.
        $access = getenv('FIREBASE_BRIDGE_ACCESS_TOKEN');
        // Optional host-managed rotating token. Never put this file in the repo
        // or document root; each PHP request reads the current atomic version.
        if (!$access && getenv('FIREBASE_BRIDGE_TOKEN_FILE')) {
            $file = realpath(getenv('FIREBASE_BRIDGE_TOKEN_FILE'));
            $root = realpath(__DIR__ . '/../..');
            if (!$file || !is_file($file) || str_starts_with($file, $root . DIRECTORY_SEPARATOR)
                || (fileperms($file) & 0077) !== 0 || filesize($file) > 16384) throw new RuntimeException('Server config');
            $access = trim(file_get_contents($file));
        }
        $key = getenv('FIREBASE_WEB_API_KEY');
        if (!$access || !$key) throw new RuntimeException('Server config');
    }
    return $config = ['project' => $project, 'auth' => $authBase, 'key' => $key, 'access' => $access,
        'documents' => "$storeBase/projects/$project/databases/(default)/documents"];
}
function fb_http(string $url, ?array $body = null, ?string $token = null): array {
    $curl = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => $headers, CURLOPT_FOLLOWLOCATION => false]);
    if ($body !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($raw === false || !$status) throw new RuntimeException('Firebase unavailable');
    return [$status, json_decode($raw, true) ?? []];
}
function fb_auth(string $method, array $body): array {
    $c = fb_config();
    return fb_http($c['auth'] . '/accounts:' . $method . '?key=' . rawurlencode($c['key']), $body);
}
function fb_decode(array $value) {
    if (isset($value['mapValue'])) return array_map('fb_decode', $value['mapValue']['fields'] ?? []);
    foreach (['stringValue', 'booleanValue', 'timestampValue', 'integerValue', 'nullValue'] as $key) {
        if (array_key_exists($key, $value)) return $key === 'integerValue' ? (int)$value[$key] : $value[$key];
    }
    return null;
}
function fb_document(string $path): ?array {
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . '/' . $path, null, $c['access']);
    if ($status === 404) return null;
    if ($status !== 200) throw new RuntimeException('Firestore unavailable');
    return array_map('fb_decode', $result['fields'] ?? []);
}
function fb_commit(array $writes): void {
    $c = fb_config();
    [$status] = fb_http($c['documents'] . ':commit', ['writes' => $writes], $c['access']);
    if ($status !== 200) throw new RuntimeException('Firestore write failed');
}
function fb_name(string $path): string {
    $url = fb_config()['documents'];
    return substr($url, strpos($url, '/projects/') + 1) . '/' . $path;
}
function fb_string(string $value): array { return ['stringValue' => $value]; }
