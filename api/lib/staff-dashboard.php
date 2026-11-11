<?php
/** Source: staff/dashboard.php. Keep its SQL, limits and counting rules. */
function api_staff_user(mysqli $conn): array {
    $user = api_current_user($conn, true);
    if ($user['account_type'] !== 'staff') { api_error('Access denied.', 403); }
    if ($user['is_first_login'] || !$user['profile_completed']) {
        api_json(['ok' => true, 'data' => null, 'redirect' => api_next_route($user)]);
    }
    return $user;
}

function api_staff_delta($now, $before) {
    if ($before == 0) {
        return $now == 0 ? ['flat', 'No change'] : ['up', '+' . (int)$now . ' new'];
    }
    $change = (int)round((($now - $before) / $before) * 100);
    if ($change > 0) return ['up', '+' . $change . '%'];
    if ($change < 0) return ['down', $change . '%'];
    return ['flat', 'No change'];
}
function api_staff_portal_breakdown(array $rows) {
    $counts = ['admin' => 0, 'staff' => 0, 'resident' => 0, 'permanent' => 0, 'temporary' => 0];
    foreach ($rows as $row) {
        $label = login_type_label($row)['text'];
        if ($row['user_type'] === 'staff') {
            // Admin and Staff are both staff-table accounts; the stored role
            // is what separates the two rails.
            if ($label === 'Admin') { $counts['admin']++; } else { $counts['staff']++; }
        } else {
            $counts['resident']++;
            if ($label === 'Temporary Resident') { $counts['temporary']++; }
            else { $counts['permanent']++; }
        }
    }
    return $counts;
}

function api_staff_dashboard(mysqli $conn): void {
    $user = api_staff_user($conn);
$total_surveys = $conn->query("SELECT COUNT(*) c FROM surveys")->fetch_assoc()['c'];
$active_surveys = $conn->query("SELECT COUNT(*) c FROM surveys WHERE status='active' AND CURDATE() BETWEEN start_date AND end_date")->fetch_assoc()['c'];
$total_residents = $conn->query("SELECT COUNT(*) c FROM residents WHERE deleted_at IS NULL")->fetch_assoc()['c'];
$total_responses = $conn->query("SELECT COUNT(*) c FROM responses")->fetch_assoc()['c'];
$pending_address_requests = $conn->query("SELECT COUNT(*) c FROM resident_update_requests WHERE status = 'pending'")->fetch_assoc()['c'];

// Small extras used by the dashboard side panel
// NOTE: surveys.status is enum('active','inactive') — there is no 'draft' value.
$inactive_surveys = $conn->query("SELECT COUNT(*) c FROM surveys WHERE status='inactive'")->fetch_assoc()['c'];
$closed_surveys = $conn->query("SELECT COUNT(*) c FROM surveys WHERE end_date < CURDATE()")->fetch_assoc()['c'];
$latest_row = $conn->query("SELECT MAX(submitted_at) d FROM responses")->fetch_assoc();
$latest_response = $latest_row['d'] ?? null;

$avg_responses = $total_surveys > 0 ? round($total_responses / $total_surveys, 1) : 0;

/* ------------------------------------------------------------
   Period-over-period figures for the metric strip.
   Read-only counts; nothing here changes what the system does,
   it only gives each headline number a direction to read against.
   ------------------------------------------------------------ */
$responses_7 = (int)$conn->query("SELECT COUNT(*) c FROM responses
                                   WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetch_assoc()['c'];
$responses_prev_7 = (int)$conn->query("SELECT COUNT(*) c FROM responses
                                        WHERE submitted_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                                          AND submitted_at <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)")->fetch_assoc()['c'];
$new_residents_30 = (int)$conn->query("SELECT COUNT(*) c FROM residents
                                        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                                          AND deleted_at IS NULL")->fetch_assoc()['c'];

/**
 * Percentage change between two periods.
 *
 * Growing from zero has no percentage, so it is reported as new
 * activity rather than as an infinite increase.
 */
list($resp_dir, $resp_delta) = api_staff_delta($responses_7, $responses_prev_7);

// Residency mix — the split that decides which resident dashboard a
// person actually sees, so it belongs on the staff overview.
$permanent_residents = 0;
$temporary_residents = 0;
$mix = $conn->query("SELECT residency_status, COUNT(*) c FROM residents WHERE deleted_at IS NULL GROUP BY residency_status");
if ($mix) {
    while ($row = $mix->fetch_assoc()) {
        if ($row['residency_status'] === 'temporary') {
            $temporary_residents = (int)$row['c'];
        } else {
            $permanent_residents += (int)$row['c'];
        }
    }
}

// Merged "Surveys" table: recent surveys plus their response counts in one query
$surveys_overview = [];
$result = $conn->query("
    SELECT s.survey_id, s.title, s.start_date, s.end_date, s.status,
           COUNT(r.response_id) AS response_count
    FROM surveys s
    LEFT JOIN responses r ON r.survey_id = s.survey_id
    GROUP BY s.survey_id, s.title, s.start_date, s.end_date, s.status
    ORDER BY s.created_at DESC
    LIMIT 8
");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $surveys_overview[] = $row;
    }
}

// ------------------------------------------------------------
// Per-survey completion: responses received vs residents who could
// have answered. Denominator is active residents only, so deactivated
// accounts don't drag every rate down.
// ------------------------------------------------------------
$eligible_residents = $conn->query("SELECT COUNT(*) c FROM residents WHERE is_active = 1 AND deleted_at IS NULL")->fetch_assoc()['c'];

/* The demographics panels only make sense once somebody is on file. With no
   residents they would render six empty frames, so the whole section is
   skipped instead. */
$demographics_ready = (int)$total_residents > 0;

/**
 * Participation: the share of active residents who have answered at
 * least one survey.
 *
 * Counted as distinct residents, not as responses. Dividing total
 * responses by resident count measures a different thing entirely and
 * runs past 100% as soon as the average resident answers more than one
 * survey — which is the normal case, not an edge case.
 */
$responding_residents = (int)$conn->query("SELECT COUNT(DISTINCT resident_id) c FROM responses")->fetch_assoc()['c'];
$participation = $eligible_residents > 0
    ? min(100, (int)round(($responding_residents / $eligible_residents) * 100))
    : 0;

$completion_rates = [];
$res = $conn->query("
    SELECT s.survey_id, s.title, COUNT(r.response_id) AS answered
    FROM surveys s
    LEFT JOIN responses r ON r.survey_id = s.survey_id
    WHERE s.status = 'active'
    GROUP BY s.survey_id, s.title
    ORDER BY answered DESC
    LIMIT 6
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $row['pct'] = $eligible_residents > 0
            ? min(100, (int)round(($row['answered'] / $eligible_residents) * 100))
            : 0;
        $completion_rates[] = $row;
    }
}

// Residents who have answered the most surveys. Read-only roll-up of
// the same responses table the rest of the page counts.
$top_responders = [];
$res = $conn->query("
    SELECT r.resident_id, r.resident_number, r.first_name, r.last_name,
           COUNT(rs.response_id) AS answered
    FROM responses rs
    JOIN residents r ON r.resident_id = rs.resident_id
    GROUP BY r.resident_id, r.resident_number, r.first_name, r.last_name
    ORDER BY answered DESC, r.last_name ASC
    LIMIT 5
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $top_responders[] = $row;
    }
}

// ------------------------------------------------------------
// Admin-only data. Staff never see this block, which is what finally
// makes the Admin Portal different from the Staff Portal.
// ------------------------------------------------------------
$is_admin_view = $user['role'] === 'admin';
$total_staff = 0;
$deactivated_staff = 0;
$deactivated_residents = 0;
$pending_deletion_requests = 0;
$recent_logins = [];
$recent_logouts = [];

if ($is_admin_view) {
    $total_staff = $conn->query("SELECT COUNT(*) c FROM staff WHERE deleted_at IS NULL")->fetch_assoc()['c'];
    $deactivated_staff = $conn->query("SELECT COUNT(*) c FROM staff WHERE is_active = 0 AND deleted_at IS NULL")->fetch_assoc()['c'];
    $deactivated_residents = $conn->query("SELECT COUNT(*) c FROM residents WHERE is_active = 0 AND deleted_at IS NULL")->fetch_assoc()['c'];

    $pending_del = $conn->query("SELECT COUNT(*) c FROM resident_delete_requests WHERE status = 'pending'");
    if ($pending_del) {
        $pending_deletion_requests = (int)$pending_del->fetch_assoc()['c'];
    }

    // login_history has been collecting rows since day one but was never
    // displayed anywhere. Two LEFT JOINs resolve the polymorphic user_id
    // to a readable name.
    // The stored user_type only says staff or resident. The label needs the
    // actual role, so the joins also carry the staff role and the resident's
    // residency status, resolved per row by login_type_label().
    // Same shape for both panels; only the event filter differs.
    $activity_sql = "
        SELECT l.user_type, l.login_time, l.account_role,
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
        WHERE l.event = '%s'
        ORDER BY l.login_time DESC
        LIMIT 10
    ";

    $res = $conn->query(sprintf($activity_sql, 'login'));
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $recent_logins[] = $row;
        }
    }

    $res = $conn->query(sprintf($activity_sql, 'logout'));
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $recent_logouts[] = $row;
        }
    }
}


    $data = [];
    foreach (explode(' ', 'total_surveys active_surveys total_residents total_responses pending_address_requests inactive_surveys closed_surveys avg_responses responses_7 responses_prev_7 new_residents_30 permanent_residents temporary_residents eligible_residents responding_residents participation') as $key) { $data[$key] = (int)$$key; }
    $data['avg_responses'] = $avg_responses;
    $data += [
        'as_of' => date('F j, Y'), 'today' => date('Y-m-d'),
        'trend_from' => date('Y-m-d', strtotime('-29 day')),
        'resp_dir' => $resp_dir, 'resp_delta' => $resp_delta,
        'latest_response_label' => $latest_response ? date('M j, Y', strtotime($latest_response)) : '—',
        'surveys_overview' => $surveys_overview, 'completion_rates' => $completion_rates,
        'top_responders' => $top_responders, 'demographics_ready' => $demographics_ready,
        'is_admin_view' => $is_admin_view,
    ];
    if ($is_admin_view) {
        $data['admin'] = [
            'total_staff' => (int)$total_staff, 'deactivated_staff' => (int)$deactivated_staff,
            'deactivated_residents' => (int)$deactivated_residents,
            'pending_deletion_requests' => $pending_deletion_requests,
            'login_counts' => api_staff_portal_breakdown($recent_logins),
            'logout_counts' => api_staff_portal_breakdown($recent_logouts),
        ];
        foreach (['recent_logins', 'recent_logouts'] as $key) {
            $data['admin'][$key] = array_map(function ($row) {
                return ['person' => $row['person'], 'type_label' => login_type_label($row),
                    'time_label' => date('M j, Y g:i A', strtotime($row['login_time']))];
            }, $$key);
        }
    }
    api_json(['ok' => true, 'data' => $data]);
}
