<?php
/** CLI-only handler regression: real auth/session/helpers, in-memory mysqli spy. No DB writes. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
session_save_path(sys_get_temp_dir());
require __DIR__ . '/../../config/functions.php';
require __DIR__ . '/../../api/lib/session.php';
require __DIR__ . '/../../api/lib/auth.php';

class LoginResponse extends RuntimeException {
    public function __construct(public array $body, public int $status) { parent::__construct('response'); }
}
function api_json(array $body, int $status = 200): void { throw new LoginResponse($body, $status); }
function api_error(string $message, int $status = 400): void { api_json(['ok' => false, 'message' => $message], $status); }
function api_input(array $fields): array { return array_intersect_key($GLOBALS['input'], array_flip($fields)); }

class LoginResult extends mysqli_result {
    public function __construct(private ?array $row) {}
    public function fetch_assoc(): array|false|null { return $this->row; }
}
class LoginStatement extends mysqli_stmt {
    private array $values = [];
    public function __construct(private LoginConnection $db, private string $sql) {}
    public function bind_param(string $types, &...$vars): bool { $this->values = $vars; return true; }
    public function execute(?array $params = null): bool {
        if (str_starts_with($this->sql, 'INSERT INTO login_history')) $this->db->history[] = $this->values;
        return true;
    }
    public function get_result(): mysqli_result|false {
        if (preg_match('/^SELECT \* FROM (residents|staff) WHERE (resident_number|staff_number|username) = \? AND deleted_at IS NULL LIMIT 1$/', $this->sql, $match)) {
            $this->db->identifiers[] = $this->values[0];
            foreach ($this->db->rows[$match[1]] as $row) {
                if (strcasecmp($row[$match[2]], $this->values[0]) === 0 && empty($row['deleted_at'])) return new LoginResult($row);
            }
            return new LoginResult(null);
        }
        if (preg_match('/^SELECT (role|residency_status) FROM (staff|residents) WHERE (staff_id|resident_id) = \? LIMIT 1$/', $this->sql, $match)) {
            foreach ($this->db->rows[$match[2]] as $row) {
                if ($row[$match[3]] === $this->values[0]) return new LoginResult([$match[1] => $row[$match[1]]]);
            }
        }
        throw new RuntimeException('Unexpected statement: ' . $this->sql);
    }
    public function close(): void {}
}
class LoginConnection extends mysqli {
    public array $lookups = [];
    public array $identifiers = [];
    public array $history = [];
    public function __construct(public array $rows) {}
    public function prepare(string $query): mysqli_stmt|false {
        if (str_starts_with($query, 'SELECT *')) $this->lookups[] = $query;
        return new LoginStatement($this, $query);
    }
    public function query(string $query, int $result_mode = MYSQLI_STORE_RESULT): mysqli_result|bool {
        // The two unchanged admin navigation count queries.
        if (!str_contains($query, 'COUNT(*)')) throw new RuntimeException('Unexpected query');
        return new LoginResult(['c' => 0]);
    }
}

$checks = 0;
function check(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    $GLOBALS['checks']++;
}
$resident = ['resident_id' => 1, 'resident_number' => 'R-2026-0001', 'first_name' => 'Test', 'last_name' => 'Resident',
    'password' => password_hash('ResidentTestA1', PASSWORD_DEFAULT), 'is_active' => 1, 'is_first_login' => 0, 'residency_status' => 'permanent'];
$staff = ['staff_id' => 2, 'staff_number' => 'S-2026-0001', 'username' => 'staff.nurse', 'full_name' => 'Test Staff',
    'password' => password_hash('StaffTestA1', PASSWORD_DEFAULT), 'role' => 'staff', 'is_active' => 1, 'is_first_login' => 0, 'profile_completed' => 1];
$admin = array_replace($staff, ['staff_id' => 3, 'staff_number' => 'S-2026-0003', 'username' => 'admin', 'role' => 'admin']);
$rows = ['residents' => [$resident, array_replace($resident, ['resident_id' => 9, 'resident_number' => 'R-2026-001'])],
    'staff' => [$staff, $admin,
        array_replace($staff, ['staff_id' => 4, 'staff_number' => 'S-2026-0004', 'username' => 'R-2026-0001']),
        array_replace($staff, ['staff_id' => 5, 'staff_number' => 'S-2026-0005', 'username' => 'S-2026-0001', 'password' => $resident['password']])]];
$generic = 'Invalid username/Resident Number or password.';

function attempt(string $id, string $password, string $column, array $rows, int $status, string $destination = '', ?string $message = null): array {
    $_SESSION = [];
    $before = session_id();
    // A forged client type must have no influence on detection.
    $GLOBALS['input'] = ['identifier' => $id, 'password' => $password, 'account_type' => 'staff', 'portal' => 'staff'];
    $db = new LoginConnection($rows);
    try { api_login($db); throw new RuntimeException('Missing response'); }
    catch (LoginResponse $response) {
        check($response->status === $status, 'Response status');
        $table = $column === 'resident_number' ? 'residents' : 'staff';
        check($db->lookups === ["SELECT * FROM $table WHERE $column = ? AND deleted_at IS NULL LIMIT 1"], 'Exactly one table and lookup column');
        $expected = $column === 'username' ? trim($id) : strtoupper(trim($id));
        check($db->identifiers === [$expected], 'Lookup receives trimmed ID and uppercase account numbers');
        if ($status === 200) {
            check($response->body['redirect'] === $destination, 'Preserved destination');
            check(session_id() !== $before, 'Session regenerated');
            check(count($db->history) === 1 && $db->history[0][3] === 'login', 'Login logged once');
            $user = $response->body['data']['user'];
            check(isset($_SESSION[$user['account_type'] . '_id']), 'Correct session identity');
            check(!isset($user['password']), 'Sanitised user');
        } else {
            check($response->body['message'] === $message, 'Unchanged error');
            check($db->history === [] && $_SESSION === [], 'No identity or login event on failure');
        }
        return $response->body;
    }
}

try {
    foreach (['R-2026-0001', 'r-2026-0001', ' R-2026-0001 '] as $id) {
        check(api_detect_account_type($id) === ['type' => 'resident', 'identifier' => 'R-2026-0001'], 'Resident detection');
        attempt($id, 'ResidentTestA1', 'resident_number', $rows, 200, '/resident/dashboard');
    }
    foreach (['S-2026-0001', ' s-2026-0001 '] as $id) {
        check(api_detect_account_type($id) === ['type' => 'staff', 'identifier' => 'S-2026-0001'], 'Staff detection');
        attempt($id, 'StaffTestA1', 'staff_number', $rows, 200, '/staff/dashboard');
    }
    foreach (['admin', 'Admin', 'staff.nurse'] as $id) {
        check(api_detect_account_type($id) === ['type' => 'username', 'identifier' => $id], 'Username detection');
        attempt($id, 'StaffTestA1', 'username', $rows, 200, '/staff/dashboard');
    }
    foreach (['R-2026-001', 'S-2026-001', 'R-2026-00001', 'R-２０２６-0001'] as $id) {
        check(api_detect_account_type($id)['type'] === 'username', 'Malformed number is a username');
        attempt($id, 'ResidentTestA1', 'username', $rows, 401, '', $generic);
    }
    attempt('R-2026-0001', 'StaffTestA1', 'resident_number', $rows, 401, '', $generic);
    attempt('S-2026-0001', 'ResidentTestA1', 'staff_number', $rows, 401, '', $generic);
    // Even a missing reserved number cannot fall back to a matching staff username.
    $missing = $rows; $missing['residents'] = [];
    attempt('R-2026-0001', 'StaffTestA1', 'resident_number', $missing, 401, '', $generic);
    $missing = $rows; array_shift($missing['staff']);
    attempt('S-2026-0001', 'ResidentTestA1', 'staff_number', $missing, 401, '', $generic);
    attempt('staff.nurse', 'WrongPasswordA1', 'username', $rows, 401, '', $generic);
    attempt('missing', 'StaffTestA1', 'username', $rows, 401, '', $generic);
    foreach (['residents', 'staff'] as $table) {
        $id = $table === 'residents' ? 'R-2026-0001' : 'S-2026-0001';
        $column = $table === 'residents' ? 'resident_number' : 'staff_number';
        $password = $table === 'residents' ? 'ResidentTestA1' : 'StaffTestA1';
        $changed = $rows; $changed[$table][0]['is_active'] = 0;
        attempt($id, $password, $column, $changed, 403, '', $table === 'residents'
            ? 'This account has been deactivated. Please contact the Barangay Health Center.'
            : 'This account has been deactivated. Please contact the administrator.');
        attempt($id, 'WrongPasswordA1', $column, $changed, 401, '', $generic);
        $changed = $rows; $changed[$table][0]['deleted_at'] = '2026-11-08 00:00:00';
        attempt($id, $password, $column, $changed, 401, '', $generic);
        $changed = $rows; $changed[$table][0]['is_first_login'] = 1;
        $portal = $table === 'residents' ? 'resident' : 'staff';
        attempt($id, $password, $column, $changed, 200, "/$portal/change-password");
    }
    $changed = $rows; $changed['staff'][0]['profile_completed'] = 0;
    attempt('staff.nurse', 'StaffTestA1', 'username', $changed, 200, '/staff/complete-profile');
    $changed['staff'][0]['is_first_login'] = 1;
    attempt('staff.nurse', 'StaffTestA1', 'username', $changed, 200, '/staff/change-password');
    echo "PASS: $checks detection/API assertions; no database writes.\n";
} finally { session_unset(); session_destroy(); }
