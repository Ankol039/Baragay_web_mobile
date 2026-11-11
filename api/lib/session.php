<?php
/** Staff wins when legacy session data contains both identities, as on login.php. */
function api_identity(): ?array {
    if (isset($_SESSION['staff_id'])) {
        return ['staff', (int)$_SESSION['staff_id']];
    }
    if (isset($_SESSION['resident_id'])) {
        return ['resident', (int)$_SESSION['resident_id']];
    }
    return null;
}

function api_logout(mysqli $conn): void {
    $identity = api_identity();
    if ($identity && $identity[1]) {
        log_logout($conn, $identity[0], $identity[1]);
    }
    session_unset();
    session_destroy();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000, 'path' => $params['path'],
            'domain' => $params['domain'], 'secure' => $params['secure'],
            'httponly' => $params['httponly'], 'samesite' => $params['samesite'] ?? '',
        ]);
    }
}

function api_account(mysqli $conn, string $type, int $id): ?array {
    // Identifiers are internal literals, never request parameters.
    $table = $type === 'staff' ? 'staff' : 'residents';
    $key = $type === 'staff' ? 'staff_id' : 'resident_id';
    $stmt = $conn->prepare("SELECT * FROM $table WHERE $key = ? LIMIT 1");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $account = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $account;
}

function api_current_user(mysqli $conn, bool $required = false): ?array {
    $identity = api_identity();
    if (!$identity) {
        if ($required) {
            api_error('Please sign in to continue.', 401);
        }
        return null;
    }
    [$type, $id] = $identity;
    $row = api_account($conn, $type, $id);
    if (!$row || !empty($row['deleted_at'])) {
        api_logout($conn);
        api_error('Invalid username/Resident Number or password.', 401);
    }
    // Match the resident header. The staff header checks archive only.
    if ($type === 'resident' && isset($row['is_active']) && (int)$row['is_active'] === 0) {
        api_logout($conn);
        api_error('This account has been deactivated. Please contact the Barangay Health Center.', 403);
    }
    return api_user($conn, $type, $row);
}

/** Explicit allowlist: hashes and private profile fields never enter JSON. */
function api_user(mysqli $conn, string $type, array $row): array {
    $staff = $type === 'staff';
    $role = $staff ? strtolower(trim($row['role'])) : 'resident';
    $name = $staff ? $row['full_name'] : trim($row['first_name'] . ' ' . $row['last_name']);
    $title = (string)($row['courtesy_title'] ?? '');
    $photo = (string)($row['photo_path'] ?? '');
    $has_photo = account_photo_exists($photo, __DIR__ . '/../..');
    $status = $staff ? '' : (string)($row['residency_status'] ?? '');
    $residence_type = $staff ? '' : (string)($row['residence_type'] ?? '');
    $user = [
        'id' => (int)$row[$staff ? 'staff_id' : 'resident_id'],
        'account_type' => $type, 'role' => $role, 'name' => $name,
        'display_name' => with_courtesy_title($title, $name),
        'first_name' => (string)($row['first_name'] ?? ''), 'courtesy_title' => $title,
        'photo' => $has_photo ? $photo : null, 'photo_path' => $photo,
        'has_photo' => $has_photo,
        'initial' => account_initial($row['first_name'] ?? '', $name, $title, $staff ? 'S' : 'R'),
        'is_first_login' => !empty($row['is_first_login']),
        // There is no resident profile_completed column or profile onboarding gate.
        'profile_completed' => $staff ? (int)($row['profile_completed'] ?? 1) === 1 : true,
        'is_active' => (int)($row['is_active'] ?? 1) === 1, 'deleted_at' => null,
        'portal_label' => $staff ? ($role === 'admin' ? 'Admin Portal' : 'Staff Portal') : 'Resident Portal',
        'residency_status' => in_array($status, ['permanent', 'temporary'], true) ? $status : '',
        'residence_type' => $residence_type,
        'residence_type_label' => $status === 'temporary' ? residence_type_label($residence_type) : '',
        'show_sidebar' => empty($row['is_first_login']) && (!$staff || (int)($row['profile_completed'] ?? 1) === 1),
    ];
    if ($staff) {
        $user['staff_number'] = $row['staff_number'];
        $user['username'] = $row['username'];
    } else {
        $user['resident_number'] = $row['resident_number'];
    }
    if ($role === 'admin') {
        $user['pending_deletions'] = (int)$conn->query("SELECT COUNT(*) AS c FROM resident_delete_requests WHERE status = 'pending'")->fetch_assoc()['c'];
        $user['archived_accounts'] = (int)$conn->query('SELECT (SELECT COUNT(*) FROM residents WHERE deleted_at IS NOT NULL) + (SELECT COUNT(*) FROM staff WHERE deleted_at IS NOT NULL) AS c')->fetch_assoc()['c'];
    }
    return $user;
}

function api_next_route(?array $user): string {
    if (!$user) {
        return '/login';
    }
    $portal = $user['account_type'];
    if ($user['is_first_login']) {
        return "/$portal/change-password";
    }
    if ($portal === 'staff' && !$user['profile_completed']) {
        return '/staff/complete-profile';
    }
    return "/$portal/dashboard";
}

function api_session_data(?array $user): array {
    $rules = [];
    foreach (password_rules() as $key => $rule) {
        $rules[] = ['key' => $key, 'label' => $rule[0]];
    }
    return ['authenticated' => $user !== null, 'user' => $user, 'password_rules' => $rules];
}
