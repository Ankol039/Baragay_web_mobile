<?php
/** Server authority: reserve exact R-/S- numbers; everything else is a username. */
function api_detect_account_type(string $value): array {
    $identifier = trim($value);
    if (preg_match('/\AR-[0-9]{4}-[0-9]{4}\z/i', $identifier)) {
        return ['type' => 'resident', 'identifier' => strtoupper($identifier)];
    }
    if (preg_match('/\AS-[0-9]{4}-[0-9]{4}\z/i', $identifier)) {
        return ['type' => 'staff', 'identifier' => strtoupper($identifier)];
    }
    return ['type' => 'username', 'identifier' => $identifier];
}

function api_login(mysqli $conn): void {
    if (api_identity()) {
        $user = api_current_user($conn, true);
        // Existing sessions go straight to their dashboard on the PHP login page.
        api_json(['ok' => true, 'data' => api_session_data($user), 'redirect' => '/' . $user['account_type'] . '/dashboard']);
    }
    $input = api_input(['identifier', 'password']);
    $detected = api_detect_account_type($input['identifier']);
    $identifier = $detected['identifier'];
    $password = $input['password'];
    if ($identifier === '' || $password === '') {
        api_error('Please enter your username or Resident Number and password.', 422);
    }

    // These SQL identifiers come only from the server's detection rule.
    $type = $detected['type'] === 'resident' ? 'resident' : 'staff';
    $table = $type === 'resident' ? 'residents' : 'staff';
    $column = ['resident' => 'resident_number', 'staff' => 'staff_number', 'username' => 'username'][$detected['type']];
    $stmt = $conn->prepare("SELECT * FROM $table WHERE $column = ? AND deleted_at IS NULL LIMIT 1");
    $stmt->bind_param('s', $identifier);
    $stmt->execute();
    $account = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$account || !password_verify($password, $account['password'])) {
        if (!$account) {
            password_verify($password, '$2y$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
        }
        api_error('Invalid username/Resident Number or password.', 401);
    }
    if (isset($account['is_active']) && (int)$account['is_active'] === 0) {
        api_error($type === 'staff'
            ? 'This account has been deactivated. Please contact the administrator.'
            : 'This account has been deactivated. Please contact the Barangay Health Center.', 403);
    }

    session_regenerate_id(true);
    if ($type === 'staff') {
        $_SESSION['staff_id'] = $account['staff_id'];
        $_SESSION['staff_name'] = $account['full_name'];
        $_SESSION['staff_role'] = $account['role'];
    } else {
        $_SESSION['resident_id'] = $account['resident_id'];
        $_SESSION['resident_name'] = trim($account['first_name'] . ' ' . $account['last_name']);
    }
    log_login($conn, $type, $account[$type === 'staff' ? 'staff_id' : 'resident_id']);
    $user = api_user($conn, $type, $account);
    api_json(['ok' => true, 'data' => api_session_data($user), 'redirect' => api_next_route($user)]);
}

function api_change_password(mysqli $conn): void {
    $user = api_current_user($conn, true);
    $input = api_input(['current_password', 'new_password', 'confirm_password']);
    $current = $input['current_password'];
    $new = $input['new_password'];
    $confirm = $input['confirm_password'];
    $staff = $user['account_type'] === 'staff';
    $account = api_account($conn, $user['account_type'], $user['id']);
    $failures = password_policy_errors($new);
    if (!password_verify($current, $account['password'])) {
        api_error('Current password is incorrect.', 422);
    } elseif ($staff && strcasecmp($new, (string)$account['staff_number']) === 0) {
        api_error('Your new password cannot be your Staff Number. That is the temporary password printed on your hand-over slip.', 422);
    } elseif ($failures) {
        api_error('Your new password does not meet the requirements: ' . implode('; ', $failures) . '.', 422);
    } elseif ($new === $current) {
        api_error('Your new password must be different from your current one.', 422);
    } elseif ($new !== $confirm) {
        api_error('New password and confirmation do not match.', 422);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $table = $staff ? 'staff' : 'residents';
    $key = $staff ? 'staff_id' : 'resident_id';
    $stmt = $conn->prepare("UPDATE $table SET password = ?, is_first_login = 0 WHERE $key = ?");
    $stmt->bind_param('si', $hash, $user['id']);
    $stmt->execute();
    $stmt->close();

    $outcome = $user['is_first_login'] ? 'first' : 'normal';
    if ($staff && !$user['profile_completed']) {
        $message = 'Password set. One more step: tell us how to reach you.';
        set_flash('success', $message);
        $redirect = '/staff/complete-profile';
        $ui = ['flashKind' => 'success', 'outcome' => $outcome];
    } else {
        set_flash('password_changed', $outcome);
        $message = $outcome === 'first'
            ? 'Your account is now set up. Use your new password the next time you log in.'
            : ($staff ? 'Your password has been updated. Use it the next time you log in.'
                : 'Your password has been updated successfully. Use it the next time you log in.');
        $redirect = '/' . $user['account_type'] . '/change-password';
        $ui = ['modal' => 'password-success-modal', 'outcome' => $outcome];
    }
    api_json(['ok' => true, 'data' => api_session_data(api_current_user($conn, true)),
        'message' => $message, 'redirect' => $redirect, 'ui' => $ui]);
}
