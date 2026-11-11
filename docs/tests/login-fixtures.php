<?php
/** CLI-only, disposable live-login accounts. Registry and passwords stay in temporary storage. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$action = $argv[1] ?? '';
$file = $argv[2] ?? '';
if (!in_array($action, ['create', 'clean'], true) || !is_dir(dirname($file))) exit(1);
session_save_path(sys_get_temp_dir());
require __DIR__ . '/../../config/db.php';
require __DIR__ . '/../../config/functions.php';
function login_sql(string $query, array $values): mysqli_stmt {
    global $conn;
    $stmt = $conn->prepare($query);
    $stmt->bind_param(str_repeat('s', count($values)), ...$values);
    $stmt->execute();
    return $stmt;
}
try {
    if ($action === 'create') {
        if (file_exists($file)) throw new RuntimeException('Registry already exists.');
        $token = 'LoginTest' . bin2hex(random_bytes(6));
        $state = ['token' => $token, 'accounts' => []];
        $conn->begin_transaction();
        foreach (['resident', 'staff', 'admin'] as $role) {
            $password = 'FixtureA1' . bin2hex(random_bytes(12));
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $table = $role === 'resident' ? 'residents' : 'staff';
            $column = $role === 'resident' ? 'resident_number' : 'staff_number';
            do {
                $number = ($role === 'resident' ? 'R' : 'S') . '-2098-' . random_int(1000, 9999);
                $stmt = login_sql("SELECT COUNT(*) AS c FROM $table WHERE $column = ?", [$number]);
                $exists = (int)$stmt->get_result()->fetch_assoc()['c']; $stmt->close();
            } while ($exists);
            $username = strtolower($token) . '.' . $role;
            if ($role === 'resident') {
                $stmt = login_sql('INSERT INTO residents (resident_number, first_name, last_name, password, is_active, is_first_login, residency_status) VALUES (?, ?, ?, ?, 1, 0, ?)',
                    [$number, $token, 'Fixture', $hash, 'permanent']);
            } else {
                $stmt = login_sql('INSERT INTO staff (staff_number, username, full_name, first_name, password, role, is_active, is_first_login, profile_completed) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1)',
                    [$number, $username, $token, $token, $hash, $role]);
            }
            $state['accounts'][$role] = ['id' => $stmt->insert_id, 'type' => $role === 'resident' ? 'resident' : 'staff', 'number' => $number, 'username' => $username, 'password' => $password];
            $stmt->close();
        }
        $handle = fopen($file, 'x');
        if (!$handle) throw new RuntimeException('Unable to create fixture registry.');
        chmod($file, 0600);
        if (fwrite($handle, json_encode($state, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Unable to save fixture registry.');
        fclose($handle);
        $conn->commit();
        echo "Created three disposable login accounts.\n";
    } else {
        $state = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        $conn->begin_transaction();
        $events = 0;
        foreach ($state['accounts'] as $account) {
            $resident = $account['type'] === 'resident';
            $table = $resident ? 'residents' : 'staff';
            $key = $resident ? 'resident_id' : 'staff_id';
            $column = $resident ? 'resident_number' : 'staff_number';
            $name = $resident ? 'first_name' : 'full_name';
            $stmt = login_sql("SELECT $key FROM $table WHERE $key = ? AND $column = ? AND $name = ? FOR UPDATE", [$account['id'], $account['number'], $state['token']]);
            $owned = $stmt->get_result()->fetch_assoc(); $stmt->close();
            if (!$owned) throw new RuntimeException('Fixture ownership check failed.');
            $stmt = login_sql('DELETE FROM login_history WHERE user_type = ? AND user_id = ?', [$account['type'], $account['id']]);
            $events += $stmt->affected_rows; $stmt->close();
            login_sql("DELETE FROM $table WHERE $key = ? AND $column = ? AND $name = ?", [$account['id'], $account['number'], $state['token']])->close();
        }
        $conn->commit(); unlink($file);
        echo "Cleaned three registered accounts and $events fixture login/logout events.\n";
    }
} catch (Throwable $error) {
    $conn->rollback();
    // Database exceptions can include private values; never print them.
    fwrite(STDERR, "Login fixture operation failed (" . get_class($error) . ").\n");
    exit(1);
} finally { session_unset(); session_destroy(); }
