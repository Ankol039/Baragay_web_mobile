<?php
/** Source queries from resident/dashboard.php, stat_detail.php and ajax_stats.php. */
function api_resident_id(mysqli $conn): int {
    $user = api_current_user($conn, true);
    if ($user['account_type'] !== 'resident') {
        api_error('Access denied.', 403);
    }
    return (int)$_SESSION['resident_id'];
}

function api_resident_rows(mysqli $conn, string $query, int $resident_id): array {
    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $resident_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return $rows;
}

function api_resident_dashboard(mysqli $conn): void {
    $resident_id = api_resident_id($conn);
    $queries = [
        'available' => "
    SELECT COUNT(*) AS cnt FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?)
",
        'answered' => "SELECT COUNT(*) AS cnt FROM responses WHERE resident_id = ?",
        'upcoming' => "
    SELECT s.survey_id, s.title, s.end_date FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?)
    ORDER BY s.end_date ASC LIMIT 5
",
        'me' => "SELECT * FROM residents WHERE resident_id = ?",
        'activity' => "
    SELECT DATE_FORMAT(submitted_at, '%Y-%m') AS ym, COUNT(*) AS cnt
    FROM responses
    WHERE resident_id = ? AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
    GROUP BY ym
",
        'recent' => "
    SELECT s.title, r.submitted_at
    FROM responses r
    JOIN surveys s ON s.survey_id = r.survey_id
    WHERE r.resident_id = ?
    ORDER BY r.submitted_at DESC
    LIMIT 5
",
    ];
    $available_count = (int)api_resident_rows($conn, $queries['available'], $resident_id)[0]['cnt'];
    $answered_count = (int)api_resident_rows($conn, $queries['answered'], $resident_id)[0]['cnt'];
    $upcoming = api_resident_rows($conn, $queries['upcoming'], $resident_id);
    $me = api_resident_rows($conn, $queries['me'], $resident_id)[0] ?? [];
    $is_temporary = ($me['residency_status'] ?? 'permanent') === 'temporary';
    $residence_code = (string)($me['residence_type'] ?? '');

    $month_counts = [];
    foreach (api_resident_rows($conn, $queries['activity'], $resident_id) as $row) {
        $month_counts[$row['ym']] = (int)$row['cnt'];
    }
    $activity_months = [];
    for ($i = 5; $i >= 0; $i--) {
        $key = date('Y-m', strtotime("-{$i} month"));
        $activity_months[] = ['label' => date('M Y', strtotime($key . '-01')), 'value' => $month_counts[$key] ?? 0];
    }
    $my_children = fetch_person_rows($conn, 'resident_children', $resident_id);
    $my_references = fetch_person_rows($conn, 'resident_character_references', $resident_id);
    $household_rows = [];
    if ((int)($me['is_married'] ?? 0) === 1) { $household_rows[] = ['label' => 'Spouse', 'value' => 1]; }
    if (count($my_children)) { $household_rows[] = ['label' => 'Children', 'value' => count($my_children)]; }
    if (count($my_references)) { $household_rows[] = ['label' => 'References', 'value' => count($my_references)]; }

    $residency_months = 0;
    if (!empty($me['residency_start_date'])) {
        $start = new DateTime($me['residency_start_date']);
        $now = new DateTime('today');
        if ($start <= $now) {
            $diff = $start->diff($now);
            $residency_months = ($diff->y * 12) + $diff->m;
        }
    }
    $residency_minimum = function_exists('permanent_residency_min_months') ? permanent_residency_min_months() : 6;
    $residency_pct = $is_temporary ? min(100, (int)round(($residency_months / max(1, $residency_minimum)) * 100)) : 100;
    $recent_submissions = api_resident_rows($conn, $queries['recent'], $resident_id);
    $assigned_total = $available_count + $answered_count;
    $completion_pct = $assigned_total > 0 ? (int)round(($answered_count / $assigned_total) * 100) : 0;
    $next_deadline = $upcoming ? $upcoming[0]['end_date'] : null;
    $days_left = $next_deadline ? (int)floor((strtotime($next_deadline) - strtotime('today')) / 86400) : null;
    foreach ($upcoming as &$row) { $row['end_date_label'] = date('M j, Y', strtotime($row['end_date'])); }
    unset($row);
    foreach ($recent_submissions as &$row) { $row['submitted_at_label'] = date('M j, Y', strtotime($row['submitted_at'])); }
    unset($row);
    // Keep SELECT * compatibility on the server; serialize only fields this screen uses.
    $own_record = [];
    foreach (['address', 'household_number', 'barangay', 'municipality', 'province',
              'temporary_address', 'temp_barangay', 'temp_municipality', 'temp_province', 'residency_start_date'] as $field) {
        $own_record[$field] = (string)($me[$field] ?? '');
    }
    api_json(['ok' => true, 'data' => [
        'resident_name' => (string)($_SESSION['resident_name'] ?? ''),
        'available_count' => $available_count, 'answered_count' => $answered_count,
        'assigned_total' => $assigned_total, 'completion_pct' => $completion_pct,
        'completion' => [['label' => 'Completed', 'value' => $answered_count], ['label' => 'Available', 'value' => $available_count]],
        'upcoming' => $upcoming, 'me' => $own_record,
        'is_temporary' => $is_temporary, 'residence_code' => $residence_code,
        'residence_name' => function_exists('residence_type_label') ? residence_type_label($residence_code) : '',
        'activity_months' => $activity_months, 'has_activity' => $answered_count > 0,
        'household_rows' => $household_rows, 'has_household' => !empty($household_rows),
        'residency_months' => $residency_months, 'residency_minimum' => $residency_minimum,
        'residency_pct' => $residency_pct, 'has_residency_progress' => !empty($me['residency_start_date']),
        'residency_start_label' => !empty($me['residency_start_date']) ? date('M j, Y', strtotime($me['residency_start_date'])) : null,
        'recent_submissions' => $recent_submissions, 'next_deadline' => $next_deadline,
        'next_deadline_label' => $next_deadline ? date('M j, Y', strtotime($next_deadline)) : null, 'days_left' => $days_left,
    ]]);
}

function api_resident_stat_detail(mysqli $conn): void {
    $resident_id = api_resident_id($conn);
    $queries = [
        'available' => "
            SELECT s.survey_id, s.title, s.description, s.end_date
            FROM surveys s
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
              AND NOT EXISTS (
                  SELECT 1 FROM responses r
                  WHERE r.survey_id = s.survey_id AND r.resident_id = ?
              )
            ORDER BY s.end_date ASC",
        'completed' => "
            SELECT s.title, r.submitted_at
            FROM responses r
            JOIN surveys s ON s.survey_id = r.survey_id
            WHERE r.resident_id = ?
            ORDER BY r.submitted_at DESC",
        'assigned' => "
            SELECT s.survey_id, s.title, s.end_date,
                   EXISTS (
                       SELECT 1 FROM responses r
                       WHERE r.survey_id = s.survey_id AND r.resident_id = ?
                   ) AS answered
            FROM surveys s
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
            ORDER BY answered ASC, s.end_date ASC",
    ];
    $view = $_GET['view'] ?? '';
    if (!is_string($view) || !isset($queries[$view])) {
        api_json(['ok' => true, 'data' => null, 'redirect' => '/resident/dashboard']);
    }
    $rows = api_resident_rows($conn, $queries[$view], $resident_id);
    foreach ($rows as &$row) {
        if (isset($row['survey_id'])) { $row['survey_id'] = (int)$row['survey_id']; }
        if (isset($row['answered'])) { $row['answered'] = (int)$row['answered']; }
        if (isset($row['end_date'])) { $row['end_date_label'] = date('M j, Y', strtotime($row['end_date'])); }
        if (isset($row['submitted_at'])) { $row['submitted_at_label'] = date('M j, Y g:i A', strtotime($row['submitted_at'])); }
    }
    unset($row);
    api_json(['ok' => true, 'data' => ['view' => $view, 'count' => count($rows), 'rows' => $rows]]);
}
