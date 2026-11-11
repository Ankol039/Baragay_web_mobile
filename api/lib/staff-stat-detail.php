<?php
/** The eight source views and SQL; row presentation is handled by React. */
function api_staff_stat_detail(mysqli $conn): void {
$user = api_staff_user($conn);
$views = [

    'total_surveys' => [
        'title'    => 'Total Surveys',
        'subtitle' => 'Every survey ever created, newest first.',
        'unit'     => 'surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Period', 'Status', 'Responses', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.start_date, s.end_date, s.status,
                   COUNT(r.response_id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.survey_id
            GROUP BY s.survey_id, s.title, s.start_date, s.end_date, s.status
            ORDER BY s.created_at DESC",
    ],

    'active_surveys' => [
        'title'    => 'Active Surveys',
        'subtitle' => 'Surveys marked active and currently inside their open period.',
        'unit'     => 'open surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Closes On', 'Days Left', 'Responses', ''],
        'sql'      => "
            SELECT s.survey_id, s.title, s.end_date,
                   DATEDIFF(s.end_date, CURDATE()) AS days_left,
                   COUNT(r.response_id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.survey_id
            WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
            GROUP BY s.survey_id, s.title, s.end_date
            ORDER BY s.end_date ASC",
    ],

    'total_residents' => [
        'title'    => 'Total Residents',
        'subtitle' => 'All registered resident accounts.',
        'unit'     => 'residents',
        'admin'    => false,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency', 'Account'],
        'sql'      => "
            SELECT resident_id, resident_number, first_name, last_name,
                   contact_number, residency_status, is_active
            FROM residents
            WHERE deleted_at IS NULL
            ORDER BY last_name ASC, first_name ASC",
    ],

    'total_responses' => [
        'title'    => 'Survey Responses',
        'subtitle' => 'Every response submitted, newest first.',
        'unit'     => 'responses',
        'admin'    => false,
        'columns'  => ['Survey', 'Resident', 'Submitted'],
        'sql'      => "
            SELECT s.title, r.submitted_at,
                   CONCAT(res.first_name, ' ', res.last_name) AS resident_name
            FROM responses r
            JOIN surveys s ON s.survey_id = r.survey_id
            LEFT JOIN residents res ON res.resident_id = r.resident_id
            ORDER BY r.submitted_at DESC
            LIMIT 200",
    ],

    // ---------- Administrator-only views ----------

    'staff_accounts' => [
        'title'    => 'Staff Accounts',
        'subtitle' => 'All staff and administrator accounts.',
        'unit'     => 'accounts',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Account', 'Created'],
        'sql'      => "
            SELECT full_name, username, role, is_active, created_at
            FROM staff
            WHERE deleted_at IS NULL
            ORDER BY role ASC, full_name ASC",
    ],

    'deactivated_residents' => [
        'title'    => 'Deactivated Residents',
        'subtitle' => 'Resident accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated residents',
        'admin'    => true,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency'],
        'sql'      => "
            SELECT resident_number, first_name, last_name, contact_number, residency_status
            FROM residents
            WHERE is_active = 0 AND deleted_at IS NULL
            ORDER BY last_name ASC",
    ],

    'deactivated_staff' => [
        'title'    => 'Deactivated Staff',
        'subtitle' => 'Staff accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated staff',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Created'],
        'sql'      => "
            SELECT full_name, username, role, created_at
            FROM staff
            WHERE is_active = 0 AND deleted_at IS NULL
            ORDER BY full_name ASC",
    ],

    'recent_logins' => [
        'title'    => 'Login Activity',
        'subtitle' => 'Sign-ins across both portals, newest first.',
        'unit'     => 'sign-ins',
        'admin'    => true,
        'columns'  => ['User', 'Type', 'Date & Time'],
        'sql'      => "
            SELECT l.user_type, l.login_time,
                   st.role AS staff_role,
                   r.residency_status,
                   COALESCE(
                       CONCAT(r.first_name, ' ', r.last_name),
                       st.full_name,
                       CONCAT('User #', l.user_id)
                   ) AS person
            FROM login_history l
            LEFT JOIN residents r ON l.user_type = 'resident' AND r.resident_id = l.user_id
            LEFT JOIN staff st    ON l.user_type = 'staff'    AND st.staff_id  = l.user_id
            ORDER BY l.login_time DESC
            LIMIT 100",
    ],
];


$key = $_GET['view'] ?? '';
if (!is_string($key) || !isset($views[$key]) || ($views[$key]['admin'] && $user['role'] !== 'admin')) {
    api_survey_destination('/staff/dashboard');
}
$view = $views[$key];
$rows = [];
$result = $conn->query($view['sql']);
if ($result) while ($row = $result->fetch_assoc()) {
    foreach (['start_date', 'end_date', 'created_at', 'submitted_at', 'login_time'] as $field) {
        if (isset($row[$field])) $row[$field . '_label'] = date(in_array($field, ['submitted_at', 'login_time'], true) ? 'M j, Y g:i A' : 'M j, Y', strtotime($row[$field]));
    }
    if ($key === 'recent_logins') $row['type_label'] = login_type_label($row);
    $rows[] = $row;
}
unset($view['sql']);
api_json(['ok' => true, 'data' => $view + ['view' => $key, 'rows' => $rows, 'count' => count($rows)]]);
}
