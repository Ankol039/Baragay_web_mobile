<?php
/** Resident Firestore boundary. Original business rules stay in PHP; no SQL. */
ini_set('display_errors', '0');
require_once __DIR__ . '/transport.php';
set_exception_handler(function (Throwable $error): void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.', 503);
});
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/profile-data.php';
require_once __DIR__ . '/profile-policy.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fb_fail('Method not allowed.', 405);
if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') fb_fail('Unsupported request content type.', 415);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fb_fail('Access denied.', 403);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 524288) fb_fail('Invalid request.', 413);
$raw = file_get_contents('php://input', false, null, 0, 524289);
if (strlen($raw) > 524288) fb_fail('Invalid request.', 413);
$object = json_decode($raw);
if (!is_object($object)) fb_fail('Invalid JSON request.', 400);
$input = json_decode($raw, true);
if (!is_string($input['idToken'] ?? null) || !is_string($input['action'] ?? null)) fb_fail('Invalid request.', 400);
[$identity, $account] = fb_verified($input);
fb_account($account);
if ($account['role'] !== 'resident' || $account['isFirstLogin'] || !$account['profileCompleted']) fb_fail('Access denied.', 403);
$uid = $identity['localId']; // Owner is always derived from the verified token.
$action = $input['action'];
if ($action === 'get') fb_reply(['ok' => true, 'data' => profile_data($uid, $account)]);
if (!in_array($action, ['contact', 'birthdate', 'nameAddress', 'family', 'photo', 'removePhoto'], true)) fb_fail('Not found.', 404);
if ($action === 'family') foreach (['children', 'references'] as $key) {
    $rows = $object->$key ?? [];
    if (!is_array($rows)) fb_fail('Invalid request field: ' . $key . '.');
    foreach ($rows as $row) if (!is_object($row)) fb_fail('Invalid request field: ' . $key . '.');
}

function profile_encode($value): array {
    if ($value === null) return ['nullValue' => null];
    if ($value instanceof DateTimeInterface) return ['timestampValue' => $value->format('Y-m-d\TH:i:s\Z')];
    if (is_bool($value)) return ['booleanValue' => $value];
    if (is_int($value)) return ['integerValue' => (string)$value];
    if (is_array($value)) return ['mapValue' => ['fields' => (object)array_map('profile_encode', $value)]];
    if (strlen($value) > 20000) throw new RuntimeException('Field too large');
    return fb_string($value);
}
function profile_write(string $path, array $data, array $mask = [], array $timestamps = []): array {
    profile_bounds($data);
    $write = ['update' => ['name' => fb_name($path), 'fields' => profile_encode($data)['mapValue']['fields']]];
    if ($mask) $write['updateMask'] = ['fieldPaths' => $mask];
    if ($timestamps) $write['updateTransforms'] = array_map(fn($field) => ['fieldPath' => $field, 'setToServerValue' => 'REQUEST_TIME'], $timestamps);
    return $write;
}
function profile_bounds(array $data): void {
    // Preserve MySQL column bounds on the trusted (rules-bypassing) writer.
    $limits = ['email' => 100, 'number' => 20, 'courtesyTitle' => 20, 'firstName' => 50, 'middleName' => 50,
        'lastName' => 50, 'nameExtension' => 20, 'gender' => 20, 'occupation' => 100, 'hotlineNumber' => 30,
        'displayLine' => 255, 'previousAddress' => 255, 'reason' => 255];
    foreach ($data as $key => $value) {
        if (is_array($value)) profile_bounds($value);
        elseif (isset($limits[$key]) && is_string($value) && mb_strlen($value) > $limits[$key]) throw new RuntimeException('Field too large');
    }
}
// Photo has a larger, separately bounded value than the ordinary string fields.
try { $photo = $action === 'photo' ? profile_photo($input) : ''; }
catch (ProfileInputError $error) { fb_fail($error->getMessage()); }
$c = fb_config();
for ($attempt = 0; $attempt < 5; $attempt++) {
    [$status, $begin] = fb_http($c['documents'] . ':beginTransaction', ['options' => ['readWrite' => (object)[]]], $c['access']);
    if ($status !== 200) throw new RuntimeException('Transaction unavailable');
    $transaction = $begin['transaction'];
    try {
        $paths = ['users/' . $uid, 'residents/' . $uid, 'pendingRequests/' . $uid . '_nameAddress', 'pendingRequests/' . $uid . '_family', 'accountLocks/' . $uid];
        [$status, $batch] = fb_http($c['documents'] . ':batchGet', ['documents' => array_map('fb_name', $paths), 'transaction' => $transaction], $c['access']);
        if ($status !== 200) throw new RuntimeException('Profile unavailable');
        $read = [];
        foreach ($batch as $item) if (isset($item['found'])) $read[$item['found']['name']] = array_map('fb_decode', $item['found']['fields']);
        if (isset($read[fb_name($paths[4])])) throw new FirebaseBoundaryError('Access denied.', 403);
        $account = $read[fb_name($paths[0])] ?? null;
        if (!$account || $account['role'] !== 'resident' || !$account['isActive'] || $account['deletedAt'] !== null || $account['isFirstLogin'] || !$account['profileCompleted']) profile_error('Access denied.');
        $resident = $read[fb_name($paths[1])] ?? null;
        if (!$resident) throw new RuntimeException('Profile unavailable');
        $writes = [];
        if ($action === 'contact') {
            $writes[] = profile_write($paths[1], ['contact' => profile_contact($input)], ['contact'], ['updatedAt']);
            $message = 'Your email and contact information have been updated successfully.';
        } elseif (in_array($action, ['photo', 'removePhoto'], true)) {
            $writes[] = ['update' => ['name' => fb_name($paths[1]), 'fields' => ['photoDataUrl' => fb_string($photo)]],
                'updateMask' => ['fieldPaths' => ['photoDataUrl']], 'updateTransforms' => [['fieldPath' => 'updatedAt', 'setToServerValue' => 'REQUEST_TIME']]];
            $writes[] = ['delete' => fb_name('profileImages/' . $uid)];
            $message = $action === 'photo' ? 'Profile photo uploaded successfully.' : 'Profile photo removed. Your initial is shown instead.';
        } else {
            // Query as well as checking pointers: imported legacy queues can lack a slot.
            [$pendingNames, $pendingFamily] = profile_pending($uid, $transaction);
            $pending = (bool)($pendingNames || $pendingFamily || isset($read[fb_name($paths[2])]) || isset($read[fb_name($paths[3])]));
            $people = []; $reason = '';
            if ($action === 'family') {
                [$proposed, $people, $reason] = profile_family($input, $pending);
                $message = 'Your family details change was sent to barangay staff for review.';
            } elseif ($action === 'birthdate') {
                $proposed = profile_birthdate($input, $resident, $pending);
                $message = 'Your birthdate correction has been sent to staff for review.';
            } else {
                $proposed = profile_name_address($input, $resident, $pending);
                $message = 'Your name and address update request has been sent to staff for review.';
            }
            $kind = $action === 'family' ? 'family' : 'nameAddress';
            $id = bin2hex(random_bytes(16)); $path = ($kind === 'family' ? 'familyRequests/' : 'nameAddressRequests/') . $id;
            $request = ['kind' => $kind, 'ownerUid' => $uid, 'ownerIdentifier' => $account['identifier'], 'ownerDisplayName' => $account['displayName'],
                'requestedByUid' => $uid, 'requestedByName' => $account['displayName'], 'proposed' => $proposed,
                'previousAddress' => $action === 'nameAddress' ? $resident['permanentAddress']['displayLine'] : '', 'reason' => $reason,
                'firstReferenceId' => $kind === 'family' ? 'reference-0' : null, 'status' => 'pending', 'reviewedAt' => null,
                'reviewedByUid' => null, 'reviewedByName' => '', 'reviewComment' => '', 'legacyId' => null];
            $writes[] = profile_write($path, $request, [], ['requestedAt']);
            $writes[] = profile_write('pendingRequests/' . $uid . '_' . $kind, ['ownerUid' => $uid, 'kind' => $kind, 'requestId' => $id]);
            foreach ($people as $key => $rows) foreach ($rows as $order => $person) {
                $collection = $key === 'references' ? 'characterReferences' : 'children';
                $pid = ($key === 'references' ? 'reference-' : 'child-') . $order;
                $writes[] = profile_write($path . '/' . $collection . '/' . $pid,
                    ['person' => profile_map($person, PROFILE_PERSON), 'displayOrder' => $order, 'legacyId' => null], [], ['createdAt']);
            }
        }
        if (count($writes) > 500) throw new RuntimeException('Too many people');
        [$status] = fb_http($c['documents'] . ':commit', ['transaction' => $transaction, 'writes' => $writes], $c['access']);
        if ($status === 409) continue;
        if ($status !== 200) throw new RuntimeException('Profile save unavailable');
        fb_reply(['ok' => true, 'data' => profile_data($uid, $account), 'message' => $message]);
    } catch (Throwable $error) {
        fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
        if ($error instanceof ProfileInputError) fb_fail($error->getMessage());
        throw $error;
    }
}
throw new RuntimeException('Profile changed; retry');
