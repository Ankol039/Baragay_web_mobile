<?php
const FB_INVALID = 'Invalid username/Resident Number or password.';
class FirebaseBoundaryError extends RuntimeException {}
function fb_unlocked(string $uid): void {
    if (fb_document('accountLocks/' . rawurlencode($uid))) throw new FirebaseBoundaryError('Access denied.', 403);
}
/** Read actor and its saga lock in the same transaction as the mutation. */
function fb_account_transaction(string $uid, string $transaction): array {
    $c = fb_config();
    $user = fb_name('users/' . rawurlencode($uid));
    $lock = fb_name('accountLocks/' . rawurlencode($uid));
    [$status, $rows] = fb_http($c['documents'] . ':batchGet', ['documents' => [$user, $lock], 'transaction' => $transaction], $c['access']);
    if ($status !== 200) throw new RuntimeException('Actor snapshot unavailable');
    $account = null;
    foreach ($rows as $row) if (isset($row['found'])) {
        if ($row['found']['name'] === $lock) throw new FirebaseBoundaryError('Access denied.', 403);
        if ($row['found']['name'] === $user) $account = array_map('fb_decode', $row['found']['fields'] ?? []);
    }
    if (!$account || ($account['uid'] ?? null) !== $uid || empty($account['isActive']) || ($account['deletedAt'] ?? null) !== null)
        throw new FirebaseBoundaryError('Access denied.', 403);
    return $account;
}
function fb_detect(string $identifier): array {
    $identifier = trim($identifier);
    $kind = preg_match('/\AR-[0-9]{4}-[0-9]{4}\z/i', $identifier) ? 'residentNumber'
        : (preg_match('/\AS-[0-9]{4}-[0-9]{4}\z/i', $identifier) ? 'staffNumber' : 'username');
    // Match migration/src/model.mjs normalization, including accent-insensitive usernames.
    if (class_exists('Normalizer')) $normalized = Normalizer::normalize($identifier, Normalizer::FORM_KD);
    elseif (preg_match('/\A[\x00-\x7F]*\z/', $identifier)) $normalized = $identifier;
    else throw new RuntimeException('PHP intl required for Unicode aliases');
    $normalized = mb_strtolower(preg_replace('/\p{M}/u', '', $normalized), 'UTF-8');
    return [$kind, $normalized];
}
function fb_account(?array $account): array {
    if (!$account || !in_array($account['role'] ?? '', ['resident', 'staff', 'admin'], true)
        || ($account['deletedAt'] ?? null) !== null) fb_fail(FB_INVALID, 401);
    if (empty($account['isActive'])) fb_fail($account['role'] === 'resident'
        ? 'This account has been deactivated. Please contact the Barangay Health Center.'
        : 'This account has been deactivated. Please contact the administrator.', 403);
    return $account;
}
function fb_verified(array $input): array {
    [$status, $result] = fb_auth('lookup', ['idToken' => $input['idToken'] ?? '']);
    $identity = $result['users'][0] ?? null;
    if ($status !== 200 || !$identity || !empty($identity['disabled'])) fb_fail('Please sign in to continue.', 401);
    // lookup verifies the token with Firebase; also pin its verified claims to
    // the one existing project, even if a host API key is accidentally misconfigured.
    $parts = explode('.', $input['idToken']);
    $claims = json_decode(base64_decode(strtr($parts[1] ?? '', '-_', '+/')), true);
    $project = fb_config()['project'];
    if (($claims['aud'] ?? '') !== $project || ($claims['iss'] ?? '') !== "https://securetoken.google.com/$project") fb_fail('Please sign in to continue.', 401);
    $account = fb_document('users/' . rawurlencode($identity['localId']));
    if (($account['uid'] ?? null) !== $identity['localId']) fb_fail(FB_INVALID, 401);
    fb_unlocked($identity['localId']);
    return [$identity, $account];
}
function fb_resolve(array $input): void {
    $identifier = trim($input['identifier'] ?? '');
    $password = $input['password'] ?? '';
    if ($identifier === '' || $password === '') fb_fail('Please enter your username or Resident Number and password.', 422);
    [$kind, $normalized] = fb_detect($identifier);
    $alias = fb_document('identifierAliases/' . $kind . '_' . hash('sha256', $normalized));
    // A failed lookup still performs Auth verification; never expose a public alias directory.
    [$status, $result] = fb_auth('signInWithPassword', [
        'email' => $alias['authEmail'] ?? 'missing-alias@barangay.app', 'password' => $password, 'returnSecureToken' => true]);
    if (!$alias) fb_fail(FB_INVALID, 401);
    $account = fb_document('users/' . rawurlencode($alias['uid']));
    // Auth-disabled users cannot verify credentials. Retain the role-specific inactive
    // message for an existing disabled identity; archives always use the generic refusal.
    if ($status !== 200) {
        if (($result['error']['message'] ?? '') === 'USER_DISABLED' && $account && empty($account['isActive'])) fb_account($account);
        fb_fail(FB_INVALID, 401);
    }
    if (($result['localId'] ?? '') !== $alias['uid'] || ($account['uid'] ?? '') !== $alias['uid']) fb_fail(FB_INVALID, 401);
    fb_account($account);
    fb_unlocked($alias['uid']);
    if (($kind === 'residentNumber') !== ($account['role'] === 'resident')) fb_fail(FB_INVALID, 401);
    fb_reply(['ok' => true, 'data' => ['email' => $alias['authEmail']]]);
}
function fb_history(array $input, string $event): void {
    [$identity, $account] = fb_verified($input);
    if ($event === 'login') fb_account($account);
    $operation = $input['operationId'] ?? '';
    if (!preg_match('/\A[a-f0-9-]{36}\z/', $operation)) fb_fail('Invalid request.', 400);
    $path = 'loginHistory/auth_' . hash('sha256', $identity['localId'] . ':' . $event . ':' . $operation);
    if (!fb_document($path)) {
        $resident = $account['role'] === 'resident';
        $profile = $resident ? fb_document('residents/' . rawurlencode($identity['localId'])) : null;
        $role = $resident ? (($profile['residencyStatus'] ?? '') === 'temporary' ? 'Temporary Resident' : 'Permanent Resident')
            : ($account['role'] === 'admin' ? 'Admin' : 'Staff');
        fb_commit([['update' => ['name' => fb_name($path), 'fields' => [
            'actorUid' => fb_string($identity['localId']), 'accountType' => fb_string($resident ? 'resident' : 'staff'),
            'accountRole' => fb_string($role), 'event' => fb_string($event),
            'ipAddress' => fb_string(substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 50)), 'legacyId' => ['nullValue' => null]]],
            'currentDocument' => ['exists' => false], 'updateTransforms' => [['fieldPath' => 'at', 'setToServerValue' => 'REQUEST_TIME']]]]);
    }
    fb_reply(['ok' => true]);
}
function fb_profile(array $input): void {
    [$identity, $account] = fb_verified($input);
    fb_account($account);
    $staff = $account['role'] !== 'resident';
    $profile = fb_document(($staff ? 'staff/' : 'residents/') . rawurlencode($identity['localId']));
    $person = $profile['name'] ?? [];
    $name = $staff ? $account['displayName'] : trim(($person['firstName'] ?? '') . ' ' . ($person['lastName'] ?? ''));
    if ($name === '') $name = $account['displayName'];
    $title = $person['courtesyTitle'] ?? '';
    $status = $staff ? '' : ($profile['residencyStatus'] ?? '');
    $type = $staff ? '' : ($profile['residenceType'] ?? '');
    fb_reply(['ok' => true, 'data' => ['name' => $name, 'display_name' => with_courtesy_title($title, $name),
        'first_name' => $person['firstName'] ?? '', 'courtesy_title' => $title,
        'initial' => account_initial($person['firstName'] ?? '', $name, $title, $staff ? 'S' : 'R'),
        'photo_data_url' => $profile['photoDataUrl'] ?? null,
        'residency_status' => $status, 'residence_type' => $type,
        'residence_type_label' => $status === 'temporary' ? residence_type_label($type) : '']]);
}
function fb_password(array $input): void {
    [$identity, $account] = fb_verified($input);
    fb_account($account);
    $current = $input['current_password'] ?? '';
    $new = $input['new_password'] ?? '';
    $confirm = $input['confirm_password'] ?? '';
    [$status, $verified] = fb_auth('signInWithPassword', ['email' => $identity['email'], 'password' => $current, 'returnSecureToken' => true]);
    if ($status !== 200 || ($verified['localId'] ?? '') !== $identity['localId']) fb_fail('Current password is incorrect.', 422);
    $staff = $account['role'] !== 'resident';
    $failures = password_policy_errors($new);
    if ($staff && strcasecmp($new, $account['identifier']) === 0) {
        fb_fail('Your new password cannot be your Staff Number. That is the temporary password printed on your hand-over slip.', 422);
    } elseif ($failures) {
        fb_fail('Your new password does not meet the requirements: ' . implode('; ', $failures) . '.', 422);
    } elseif ($new === $current) {
        fb_fail('Your new password must be different from your current one.', 422);
    } elseif ($new !== $confirm) {
        fb_fail('New password and confirmation do not match.', 422);
    }
    require_once __DIR__ . '/auth-password-store.php';
    fb_password_commit($identity['localId'], $verified['idToken'], $new);
    $outcome = $account['isFirstLogin'] ? 'first' : 'normal';
    $portal = $staff ? 'staff' : 'resident';
    $onboarding = $staff && !$account['profileCompleted'];
    $message = $onboarding ? 'Password set. One more step: tell us how to reach you.' : ($outcome === 'first'
        ? 'Your account is now set up. Use your new password the next time you log in.'
        : ($staff ? 'Your password has been updated. Use it the next time you log in.' : 'Your password has been updated successfully. Use it the next time you log in.'));
    fb_reply(['ok' => true, 'message' => $message,
        'redirect' => $onboarding ? '/staff/complete-profile' : "/$portal/change-password",
        'ui' => $onboarding ? ['flashKind' => 'success', 'outcome' => $outcome] : ['modal' => 'password-success-modal', 'outcome' => $outcome]]);
}
