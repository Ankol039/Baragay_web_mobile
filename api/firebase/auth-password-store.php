<?php
/** Password update holds a transactional actor/lock read until flag completion. */
function fb_password_commit(string $uid, string $idToken, string $password): void {
    $c = fb_config();
    [$status, $begin] = fb_http($c['documents'] . ':beginTransaction', ['options' => ['readWrite' => (object)[]]], $c['access']);
    if ($status !== 200) throw new RuntimeException('Transaction unavailable');
    $transaction = $begin['transaction'];
    try {
        fb_account_transaction($uid, $transaction);
        [$status] = fb_auth('update', ['idToken' => $idToken, 'password' => $password, 'returnSecureToken' => true]);
        if ($status !== 200) throw new FirebaseBoundaryError('The request could not be completed. Please try again.', 422);
        // Auth and Firestore remain distinct services. Failed completion leaves
        // setup closed; retry with the new current password, never clear early.
        [$status] = fb_http($c['documents'] . ':commit', ['transaction' => $transaction, 'writes' => [[
            'update' => ['name' => fb_name('users/' . rawurlencode($uid)), 'fields' => ['isFirstLogin' => ['booleanValue' => false]]],
            'updateMask' => ['fieldPaths' => ['isFirstLogin']], 'currentDocument' => ['exists' => true],
            'updateTransforms' => [['fieldPath' => 'updatedAt', 'setToServerValue' => 'REQUEST_TIME']],
        ]]], $c['access']);
        if ($status !== 200) throw new RuntimeException('Password setup completion unavailable');
    } catch (Throwable $error) {
        fb_http($c['documents'] . ':rollback', ['transaction' => $transaction], $c['access']);
        throw $error;
    }
}
