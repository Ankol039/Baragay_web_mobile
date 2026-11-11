<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Dashboard';
$asset_path = '../';

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
function db_delta($now, $before) {
    if ($before == 0) {
        return $now == 0 ? ['flat', 'No change'] : ['up', '+' . (int)$now . ' new'];
    }
    $change = (int)round((($now - $before) / $before) * 100);
    if ($change > 0) return ['up', '+' . $change . '%'];
    if ($change < 0) return ['down', $change . '%'];
    return ['flat', 'No change'];
}
list($resp_dir, $resp_delta) = db_delta($responses_7, $responses_prev_7);

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
$is_admin_view = staff_is_admin();
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

/**
 * Counts one activity list by portal, splitting residents into permanent and
 * temporary so the admin can see which kind of resident is actually using
 * the system rather than one lumped total.
 */
function render_portal_bars(array $counts) {
    // Administrators are counted on their own rail, not folded into staff:
    // an admin sign-in carries different weight and should be visible as
    // such rather than hidden inside a combined total.
    $total = $counts['admin'] + $counts['staff'] + $counts['resident'];
    if ($total === 0) {
        echo '<div class="db-empty">Nothing recorded yet.</div>';
        return;
    }
    $pct = function ($n) use ($total) { return (int)round(($n / $total) * 100); };
    ?>
    <div class="db-bars">
        <div class="db-bar-row">
            <div class="db-bar-head">
                <span class="db-bar-label">Admin portal</span>
                <span class="db-bar-value"><?= (int)$counts['admin'] ?></span>
            </div>
            <div class="db-bar-track">
                <span class="db-bar-fill db-fill-admin" style="width: <?= $pct($counts['admin']) ?>%"></span>
            </div>
        </div>
        <div class="db-bar-row">
            <div class="db-bar-head">
                <span class="db-bar-label">Staff portal</span>
                <span class="db-bar-value"><?= (int)$counts['staff'] ?></span>
            </div>
            <div class="db-bar-track">
                <span class="db-bar-fill" style="width: <?= $pct($counts['staff']) ?>%"></span>
            </div>
        </div>
        <div class="db-bar-row">
            <div class="db-bar-head">
                <span class="db-bar-label">Resident portal</span>
                <span class="db-bar-value"><?= (int)$counts['resident'] ?></span>
            </div>
            <div class="db-bar-track">
                <span class="db-bar-fill db-fill-alt" style="width: <?= $pct($counts['resident']) ?>%"></span>
            </div>
        </div>
        <?php // The two resident portals, indented under the total above. ?>
        <div class="db-bar-row db-bar-sub">
            <div class="db-bar-head">
                <span class="db-bar-label">Permanent resident portal</span>
                <span class="db-bar-value"><?= (int)$counts['permanent'] ?></span>
            </div>
            <div class="db-bar-track">
                <span class="db-bar-fill db-fill-permanent" style="width: <?= $pct($counts['permanent']) ?>%"></span>
            </div>
        </div>
        <div class="db-bar-row db-bar-sub">
            <div class="db-bar-head">
                <span class="db-bar-label">Temporary resident portal</span>
                <span class="db-bar-value"><?= (int)$counts['temporary'] ?></span>
            </div>
            <div class="db-bar-track">
                <span class="db-bar-fill db-fill-temporary" style="width: <?= $pct($counts['temporary']) ?>%"></span>
            </div>
        </div>
    </div>
    <?php
}

function portal_breakdown(array $rows) {
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

// Maps a survey status to a consistent badge color across the dashboard
function status_badge_class($status) {
    $status = strtolower($status ?? '');
    if ($status === 'active') return 'badge-active';
    if ($status === 'inactive') return 'badge-inactive';
    if ($status === 'draft') return 'badge-draft';
    return 'badge-draft';
}

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1><?= $is_admin_view ? 'Admin Dashboard' : 'Staff Dashboard' ?></h1>
        <p>Survey activity as of <?= date('F j, Y') ?>.</p>
    </div>
</div>

<!-- Action sits below the heading rule so it does not crowd the account menu -->
<div class="page-actions-row">
    <a class="btn" href="add_survey.php">+ New Survey</a>
</div>

<?php /* ============================================================
        Metric strip. One rail, hairline-divided, so the headline
        numbers read as a single row of figures rather than five
        separate boxes. Each cell keeps the link it always had.
        ============================================================ */ ?>
<div class="db-strip">
    <a class="db-cell" href="stat_detail.php?view=total_surveys">
        <span class="db-cell-label">Total Surveys</span>
        <span class="db-cell-value"><?= (int)$total_surveys ?></span>
        <span class="db-cell-foot"><?= (int)$inactive_surveys ?> inactive</span>
    </a>
    <a class="db-cell" href="stat_detail.php?view=active_surveys">
        <span class="db-cell-label">Open for Answers</span>
        <span class="db-cell-value"><?= (int)$active_surveys ?></span>
        <span class="db-cell-foot"><?= (int)$closed_surveys ?> past closing date</span>
    </a>
    <a class="db-cell" href="stat_detail.php?view=total_residents">
        <span class="db-cell-label">Registered Residents</span>
        <span class="db-cell-value"><?= (int)$total_residents ?></span>
        <span class="db-cell-foot"><?= (int)$new_residents_30 ?> added in 30 days</span>
    </a>
    <a class="db-cell" href="stat_detail.php?view=total_responses">
        <span class="db-cell-label">Survey Responses</span>
        <span class="db-cell-value"><?= (int)$total_responses ?></span>
        <span class="db-cell-foot">
            <span class="db-delta is-<?= h($resp_dir) ?>"><?= h($resp_delta) ?></span>
            vs previous 7 days
        </span>
    </a>
    <a class="db-cell" href="address_requests.php">
        <span class="db-cell-label">Pending Requests</span>
        <span class="db-cell-value"><?= (int)$pending_address_requests ?></span>
        <span class="db-cell-foot">Address changes awaiting review</span>
    </a>
</div>

<?php /* ---------- Row 1: trend + participation gauge ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-panel-primary db-c8">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Responses Received</h3>
                <p class="db-panel-note">Daily submissions over the chosen period.</p>
            </div>
            <span class="db-panel-meta"><?= (int)$responses_7 ?> this week</span>
        </div>
        <?php // Narrow the chart to any period without reloading the page. ?>
        <div class="db-panel-filter no-print">
            <label for="trend-from">From</label>
            <input type="date" id="trend-from" value="<?= h(date('Y-m-d', strtotime('-29 day'))) ?>" max="<?= h(date('Y-m-d')) ?>">
            <label for="trend-to">To</label>
            <input type="date" id="trend-to" value="<?= h(date('Y-m-d')) ?>" max="<?= h(date('Y-m-d')) ?>">
            <button type="button" class="btn btn-secondary btn-small" id="trend-apply">Apply</button>
            <button type="button" class="btn btn-secondary btn-small" id="trend-reset">Last 30 days</button>
        </div>
        <div class="db-panel-body">
            <?php if ($total_responses > 0): ?>
            <div class="db-chart db-chart-md"><canvas id="chart-trend"></canvas></div>
            <?php else: ?>
            <div class="db-empty">No responses have been submitted yet.</div>
            <?php endif; ?>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Participation Rate</h3>
                <p class="db-panel-note">Active residents who have answered at least one survey.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-xs db-chart-gauge"><canvas id="chart-participation"></canvas></div>
            <ul class="db-kv" style="margin-top:6px;">
                <li><span class="db-kv-key">Residents who answered</span><span class="db-kv-val"><?= (int)$responding_residents ?> of <?= (int)$eligible_residents ?></span></li>
                <li><span class="db-kv-key">Avg. responses per survey</span><span class="db-kv-val"><?= h((string)$avg_responses) ?></span></li>
                <li><span class="db-kv-key">Last response received</span><span class="db-kv-val"><?= $latest_response ? h(date('M j, Y', strtotime($latest_response))) : '&mdash;' ?></span></li>
            </ul>
        </div>
    </div>
</div>

<?php /* ---------- Row 2: per-survey volume, status mix, residency mix ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-c5">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Responses per Survey</h3>
                <p class="db-panel-note">Eight most recently created surveys.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <?php if ($total_surveys > 0): ?>
            <div class="db-chart db-chart-lg"><canvas id="chart-responses"></canvas></div>
            <?php else: ?>
            <div class="db-empty">Create a survey to start collecting responses.</div>
            <?php endif; ?>
        </div>
    </div>

    <div class="db-panel db-c3">
        <div class="db-panel-head">
            <div><h3 class="db-panel-title">Survey Status</h3></div>
        </div>
        <div class="db-panel-body">
            <?php if ($total_surveys > 0): ?>
            <div class="db-chart db-chart-sm"><canvas id="chart-survey-status"></canvas></div>
            <?php else: ?>
            <div class="db-empty">No surveys yet.</div>
            <?php endif; ?>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Residency Mix</h3>
                <p class="db-panel-note">Permanent and temporary residents on file.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <?php if ($total_residents > 0): ?>
            <div class="db-chart db-chart-sm"><canvas id="chart-residency"></canvas></div>
            <ul class="db-kv" style="margin-top:6px;">
                <li><span class="db-kv-key">Permanent</span><span class="db-kv-val"><?= (int)$permanent_residents ?></span></li>
                <li><span class="db-kv-key">Temporary</span><span class="db-kv-val"><?= (int)$temporary_residents ?></span></li>
            </ul>
            <?php else: ?>
            <div class="db-empty">No residents registered yet.</div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php /* ---------- Row 3: completion meters + survey table ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-c4" id="completion-rate-card">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Completion Rate</h3>
                <p class="db-panel-note">Share of <?= (int)$eligible_residents ?> active residents who answered each open survey.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <?php if (!$completion_rates): ?>
            <div class="db-empty">No surveys are open for answers right now.</div>
            <?php endif; ?>
            <?php foreach ($completion_rates as $index => $c): ?>
            <?php // Only the top 3 are shown; the rest are revealed by "View All" ?>
            <div class="meter-row<?= $index >= 3 ? ' is-hidden' : '' ?>">
                <div class="meter-head">
                    <span class="meter-label" title="<?= h($c['title']) ?>"><?= h($c['title']) ?></span>
                    <span class="meter-value"><?= (int)$c['pct'] ?>%</span>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width: <?= (int)$c['pct'] ?>%"></div>
                </div>
                <span class="meter-note"><?= (int)$c['answered'] ?> of <?= (int)$eligible_residents ?> responded</span>
            </div>
            <?php endforeach; ?>

            <?php if (count($completion_rates) > 3): ?>
            <button type="button" class="view-all-link"
                    data-toggle-more="completion-rate-card"
                    data-label-more="View All (<?= count($completion_rates) ?>)"
                    data-expanded="0">View All (<?= count($completion_rates) ?>)</button>
            <?php endif; ?>
        </div>
    </div>

    <div class="db-panel db-c8">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Surveys</h3>
                <p class="db-panel-note">Most recent first, with the responses each has collected.</p>
            </div>
            <span class="db-panel-meta"><?= count($surveys_overview) ?> shown</span>
        </div>
        <div class="db-panel-body">
            <div class="db-table-wrap">
                <table>
                    <tr><th>Survey</th><th>Period</th><th>Status</th><th>Responses</th><th>Action</th></tr>
                    <?php if (!$surveys_overview): ?>
                    <tr><td colspan="5" class="empty-state">No surveys yet.</td></tr>
                    <?php endif; ?>
                    <?php foreach ($surveys_overview as $s): ?>
                    <tr>
                        <td><?= h($s['title']) ?></td>
                        <td><?= h($s['start_date']) ?> &ndash; <?= h($s['end_date']) ?></td>
                        <td><span class="badge <?= status_badge_class($s['status']) ?>"><?= h(ucfirst($s['status'])) ?></span></td>
                        <td><?= $s['response_count'] > 0 ? (int)$s['response_count'] : '<span class="muted-note">No responses yet</span>' ?></td>
                        <td><a class="btn-action btn-action-primary" title="View Results" href="results_dashboard.php?survey_id=<?= (int)$s['survey_id'] ?>"><?= nav_icon('results') ?></a></td>
                    </tr>
                    <?php endforeach; ?>
                </table>
            </div>
        </div>
    </div>
</div>

<?php /* ---------- Row 4: takeaways, most active residents, question mix ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div><h3 class="db-panel-title">At a Glance</h3></div>
        </div>
        <div class="db-panel-body">
            <ul class="db-kv">
                <li><span class="db-kv-key">Inactive surveys</span><span class="db-kv-val"><?= (int)$inactive_surveys ?></span></li>
                <li><span class="db-kv-key">Past closing date</span><span class="db-kv-val"><?= (int)$closed_surveys ?></span></li>
                <li><span class="db-kv-key">Avg. responses / survey</span><span class="db-kv-val"><?= h((string)$avg_responses) ?></span></li>
                <li><span class="db-kv-key">Residents who answered</span><span class="db-kv-val"><?= (int)$responding_residents ?> of <?= (int)$eligible_residents ?> (<?= (int)$participation ?>%)</span></li>
                <li><span class="db-kv-key">Responses this week</span><span class="db-kv-val"><?= (int)$responses_7 ?></span></li>
                <li>
                    <span class="db-kv-key">Last response</span>
                    <span class="db-kv-val"><?= $latest_response ? h(date('M j, Y', strtotime($latest_response))) : '&mdash;' ?></span>
                </li>
            </ul>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Most Active Residents</h3>
                <p class="db-panel-note">Ranked by surveys answered.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <?php if (!$top_responders): ?>
            <div class="db-empty">No one has answered a survey yet.</div>
            <?php else: ?>
            <ul class="db-rank">
                <?php foreach ($top_responders as $i => $t): ?>
                <li>
                    <span class="db-rank-pos"><?= $i + 1 ?></span>
                    <span class="db-rank-name">
                        <?= h(trim($t['first_name'] . ' ' . $t['last_name'])) ?>
                        <span class="db-rank-sub"><?= h($t['resident_number']) ?></span>
                    </span>
                    <span class="db-rank-val"><?= (int)$t['answered'] ?></span>
                </li>
                <?php endforeach; ?>
            </ul>
            <?php endif; ?>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Question Types in Use</h3>
                <p class="db-panel-note">Across every survey built so far.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div id="question-mix"><div class="db-empty">Loading question mix&hellip;</div></div>
        </div>
    </div>
</div>

<?php
/* ============================================================================
   Resident Demographics

   Drawn from the household details already typed into the Add Resident form:
   birthdate, gender, priority group, occupation, purok, and the married and
   children answers. Those fields were being collected but never shown back
   anywhere, so the effort of entering them returned nothing. These panels are
   the return.

   Skipped entirely when no residents are on file, rather than rendering six
   empty frames on a system that has only just been set up.
   ============================================================================ */
?>
<?php if ($demographics_ready): ?>
<div class="db-section-head">
    <h2>Resident Demographics</h2>
</div>

<div class="db-grid">
    <div class="db-panel db-c6">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Age Groups</h3>
                <p class="db-panel-note">Worked out from each birthdate, so it never goes stale.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-age"></canvas></div>
        </div>
    </div>

    <div class="db-panel db-c3">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Gender</h3>
                <p class="db-panel-note">As recorded on each record.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-sm"><canvas id="chart-gender"></canvas></div>
        </div>
    </div>

    <div class="db-panel db-c3">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Priority Groups</h3>
                <p class="db-panel-note">PWD, senior and pregnant residents.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-sm"><canvas id="chart-priority"></canvas></div>
        </div>
    </div>
</div>

<div class="db-grid">
    <div class="db-panel db-c5">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Common Occupations</h3>
                <p class="db-panel-note">Seven most frequent, as they were typed in.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-occupation"></canvas></div>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Residents by Purok</h3>
                <p class="db-panel-note">Where in the barangay people live.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-purok"></canvas></div>
        </div>
    </div>

    <div class="db-panel db-c3">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Household Make-up</h3>
                <p class="db-panel-note">From the marital and children answers.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-household"></canvas></div>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ($is_admin_view): ?>
<!-- ============================================================
     Administrator-only section. Staff accounts never render this,
     so the Admin Portal now differs in substance, not just labels.
     ============================================================ -->
<div class="db-section-head">
    <h2>Administration</h2>
</div>

<div class="db-admin">
    <div class="db-admin-head">
        <h2>Accounts &amp; Access</h2>
        <span class="db-pill db-pill-admin">Admin only</span>
    </div>

    <div class="db-strip">
        <a class="db-cell" href="stat_detail.php?view=staff_accounts">
            <span class="db-cell-label">Staff Accounts</span>
            <span class="db-cell-value"><?= (int)$total_staff ?></span>
            <span class="db-cell-foot">Including administrators</span>
        </a>
        <a class="db-cell" href="stat_detail.php?view=deactivated_residents">
            <span class="db-cell-label">Deactivated Residents</span>
            <span class="db-cell-value"><?= (int)$deactivated_residents ?></span>
            <span class="db-cell-foot">Cannot sign in</span>
        </a>
        <a class="db-cell" href="stat_detail.php?view=deactivated_staff">
            <span class="db-cell-label">Deactivated Staff</span>
            <span class="db-cell-value"><?= (int)$deactivated_staff ?></span>
            <span class="db-cell-foot">Cannot sign in</span>
        </a>
        <a class="db-cell" href="deletion_requests.php">
            <span class="db-cell-label">Deletion Requests</span>
            <span class="db-cell-value"><?= (int)$pending_deletion_requests ?></span>
            <span class="db-cell-foot">Waiting on your decision</span>
        </a>
    </div>

    <div class="db-grid">
        <div class="db-panel db-c8">
            <div class="db-panel-head">
                <div>
                    <h3 class="db-panel-title">Recent Login Activity</h3>
                    <p class="db-panel-note">Most recent sign-ins across both portals, newest first.</p>
                </div>
                <a class="db-panel-meta" href="stat_detail.php?view=recent_logins">View all</a>
            </div>
            <div class="db-panel-body">
                <div class="db-table-wrap">
                    <table>
                        <tr><th>User</th><th>Type</th><th>Date &amp; Time</th></tr>
                        <?php if (!$recent_logins): ?>
                        <tr><td colspan="3" class="empty-state">No login activity recorded yet.</td></tr>
                        <?php endif; ?>
                        <?php foreach ($recent_logins as $l): ?>
                        <tr>
                            <td><?= h($l['person']) ?></td>
                            <td>
                                <?php $login_label = login_type_label($l); ?>
                                <span class="db-pill <?= h($login_label['pill']) ?>">
                                    <?= h($login_label['text']) ?>
                                </span>
                            </td>
                            <td><?= h(date('M j, Y g:i A', strtotime($l['login_time']))) ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            </div>
        </div>

        <div class="db-panel db-c4">
            <div class="db-panel-head">
                <div>
                    <h3 class="db-panel-title">Sign-ins by Portal</h3>
                    <p class="db-panel-note">Of the <?= count($recent_logins) ?> most recent sign-ins.</p>
                </div>
            </div>
            <div class="db-panel-body">
                <?php $login_counts = portal_breakdown($recent_logins); ?>
                <?php render_portal_bars($login_counts); ?>
            </div>
        </div>
    </div>

    <?php // Sign-outs, the mirror of the two panels above. ?>
    <div class="db-grid">
        <div class="db-panel db-c8">
            <div class="db-panel-head">
                <div>
                    <h3 class="db-panel-title">Recent Logout Activity</h3>
                    <p class="db-panel-note">Most recent sign-outs across both portals, newest first.</p>
                </div>
                <a class="db-panel-meta" href="stat_detail.php?view=recent_logouts">View all</a>
            </div>
            <div class="db-panel-body">
                <div class="db-table-wrap">
                    <?php if (empty($recent_logouts)): ?>
                        <div class="db-empty">No sign-outs recorded yet.</div>
                    <?php else: ?>
                    <table class="db-table">
                        <thead>
                            <tr><th>User</th><th>Type</th><th>Date &amp; Time</th></tr>
                        </thead>
                        <tbody>
                            <?php foreach ($recent_logouts as $l): ?>
                            <tr>
                                <td><?= h($l['person']) ?></td>
                                <td>
                                    <?php $logout_label = login_type_label($l); ?>
                                    <span class="db-pill <?= h($logout_label['pill']) ?>">
                                        <?= h($logout_label['text']) ?>
                                    </span>
                                </td>
                                <td><?= h(date('M j, Y g:i A', strtotime($l['login_time']))) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div class="db-panel db-c4">
            <div class="db-panel-head">
                <div>
                    <h3 class="db-panel-title">Sign-outs by Portal</h3>
                    <p class="db-panel-note">Of the <?= count($recent_logouts) ?> most recent sign-outs.</p>
                </div>
            </div>
            <div class="db-panel-body">
                <?php $logout_counts = portal_breakdown($recent_logouts); ?>
                <?php render_portal_bars($logout_counts); ?>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script>
// AJAX-loaded dashboard statistics (fetched from ajax_stats.php, rendered with Chart.js)
var CHART_FONT = { family: "'Segoe UI', Roboto, Arial, sans-serif", size: 12 };
var SERIES = ['#1d6f5e', '#2f6da9', '#f2a541', '#75c79d', '#8a94a6', '#c0392b'];
var INK_MUTED = '#6b7c76';
var INK = '#223028';
var GRIDLINE = '#e9efec';

var pieLegend = {
    position: 'bottom',
    labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        padding: 14,
        color: INK,
        font: CHART_FONT
    }
};

/**
 * Writes a headline figure into the hole of a doughnut, the way the
 * reference dashboards put an overall score at the centre of the ring.
 * Purely a drawing step — it reads the value it is given and nothing else.
 */
function centreText(main, sub) {
    return {
        id: 'centreText-' + main + sub,
        afterDraw: function (chart) {
            var area = chart.chartArea;
            if (!area) { return; }
            var ctx = chart.ctx;
            var x = (area.left + area.right) / 2;
            var meta = chart.getDatasetMeta(0);
            // A half-doughnut's visual centre sits at its flat edge, not
            // the middle of the box, so anchor to the arc instead.
            var y = (meta && meta.data && meta.data[0])
                ? meta.data[0].y
                : (area.top + area.bottom) / 2;
            var half = chart.options.circumference === 180;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = INK;
            ctx.font = '700 26px ' + CHART_FONT.family;
            ctx.textBaseline = half ? 'bottom' : 'alphabetic';
            ctx.fillText(main, x, half ? y - 4 : y + 4);

            ctx.fillStyle = INK_MUTED;
            ctx.font = '600 11px ' + CHART_FONT.family;
            ctx.textBaseline = 'top';
            ctx.fillText(sub, x, half ? y + 2 : y + 12);
            ctx.restore();
        }
    };
}

/** Draws the value at the end of each horizontal bar. */
var barValueLabels = {
    id: 'barValueLabels',
    afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        chart.data.datasets.forEach(function (dataset, index) {
            var meta = chart.getDatasetMeta(index);
            if (meta.hidden) { return; }
            meta.data.forEach(function (element, i) {
                ctx.save();
                ctx.font = '700 11px ' + CHART_FONT.family;
                ctx.fillStyle = INK_MUTED;
                ctx.textBaseline = 'middle';
                ctx.fillText(dataset.data[i], element.x + 7, element.y);
                ctx.restore();
            });
        });
    }
};

// Shortens long survey titles so the plot area keeps its room.
// The untruncated title is still shown in the tooltip.
function shortLabel(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}

// ---- Participation gauge: a value the page already computed ----
(function () {
    var canvas = document.getElementById('chart-participation');
    if (!canvas) { return; }
    var pct = <?= (int)$participation ?>;   // already clamped to 0-100 in PHP
    var shown = Math.min(Math.max(pct, 0), 100);
    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Responded', 'Remaining'],
            datasets: [{
                data: [shown, 100 - shown],
                backgroundColor: [SERIES[0], '#e4ebe8'],
                borderWidth: 0,
                spacing: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: 270,
            cutout: '74%',
            layout: { padding: { bottom: 6 } },
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        },
        plugins: [centreText(pct + '%', 'of residents')]
    });
})();

fetch('ajax_stats.php')
    .then(function (r) { return r.json(); })
    .then(function (data) {
        // ---- Responses per survey: horizontal bars with end labels ----
        var responsesCanvas = document.getElementById('chart-responses');
        if (responsesCanvas && data.responses_per_survey) {
            var maxValue = Math.max.apply(null, data.responses_per_survey.map(function (d) { return d.value; }).concat([1]));
            new Chart(responsesCanvas, {
                type: 'bar',
                data: {
                    labels: data.responses_per_survey.map(function (d) { return d.label; }),
                    datasets: [{
                        label: 'Responses',
                        data: data.responses_per_survey.map(function (d) { return d.value; }),
                        backgroundColor: SERIES[0],
                        borderRadius: 4,
                        maxBarThickness: 22
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 30 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function (items) { return items[0].label; }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            suggestedMax: maxValue,
                            grid: { color: GRIDLINE, drawBorder: false },
                            ticks: { precision: 0, color: INK_MUTED, font: CHART_FONT }
                        },
                        y: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                color: INK_MUTED,
                                font: CHART_FONT,
                                autoSkip: false,
                                callback: function (value) {
                                    return shortLabel(this.getLabelForValue(value), 18);
                                }
                            }
                        }
                    }
                },
                plugins: [barValueLabels]
            });
        }

        // ---- Daily response trend ----
        var trendCanvas = document.getElementById('chart-trend');
        if (trendCanvas && data.response_trend) {
            window.trendChart = new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: data.response_trend.map(function (d) { return d.label; }),
                    datasets: [{
                        label: 'Responses',
                        data: data.response_trend.map(function (d) { return d.value; }),
                        borderColor: SERIES[0],
                        backgroundColor: 'rgba(29, 111, 94, 0.14)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                color: INK_MUTED,
                                font: CHART_FONT,
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 8
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0, color: INK_MUTED, font: CHART_FONT },
                            grid: { color: GRIDLINE, drawBorder: false }
                        }
                    }
                }
            });
        }

        // ---- Survey status, with the total in the ring ----
        var statusCanvas = document.getElementById('chart-survey-status');
        if (statusCanvas && data.survey_status) {
            var statusTotal = data.survey_status.reduce(function (sum, d) { return sum + d.value; }, 0);
            new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.survey_status.map(function (d) { return d.label; }),
                    datasets: [{
                        data: data.survey_status.map(function (d) { return d.value; }),
                        backgroundColor: [SERIES[0], SERIES[5], SERIES[4]],
                        borderWidth: 0,
                        spacing: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '66%',
                    layout: { padding: { top: 4, bottom: 4 } },
                    plugins: { legend: pieLegend }
                },
                plugins: [centreText(String(statusTotal), 'surveys')]
            });
        }

        // ---- Residency mix ----
        var residencyCanvas = document.getElementById('chart-residency');
        if (residencyCanvas && data.residency_mix) {
            var residencyTotal = data.residency_mix.reduce(function (sum, d) { return sum + d.value; }, 0);
            new Chart(residencyCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.residency_mix.map(function (d) { return d.label; }),
                    datasets: [{
                        data: data.residency_mix.map(function (d) { return d.value; }),
                        backgroundColor: [SERIES[0], SERIES[2]],
                        borderWidth: 0,
                        spacing: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '66%',
                    layout: { padding: { top: 4, bottom: 4 } },
                    plugins: { legend: pieLegend }
                },
                plugins: [centreText(String(residencyTotal), 'residents')]
            });
        }

        // ---- Question types: plain bars, no canvas needed ----
        var mixHost = document.getElementById('question-mix');
        if (mixHost) {
            var mix = data.question_types || [];
            if (!mix.length) {
                mixHost.innerHTML = '<div class="db-empty">No questions have been added to a survey yet.</div>';
            } else {
                var mixMax = Math.max.apply(null, mix.map(function (d) { return d.value; }).concat([1]));
                var rows = mix.map(function (d) {
                    var width = Math.round((d.value / mixMax) * 100);
                    return '<div class="db-bar-row">'
                         +   '<div class="db-bar-head">'
                         +     '<span class="db-bar-label">' + d.label + '</span>'
                         +     '<span class="db-bar-value">' + d.value + '</span>'
                         +   '</div>'
                         +   '<div class="db-bar-track"><span class="db-bar-fill" style="width:' + width + '%"></span></div>'
                         + '</div>';
                }).join('');
                mixHost.innerHTML = '<div class="db-bars">' + rows + '</div>';
            }
        }

        /* ================= Resident demographics =================
           Each canvas is only present when there are residents on file, so
           every block checks for its canvas first and quietly does nothing
           when the section was skipped. */

        // Small helpers, so six charts do not become six near-identical
        // blocks of options that can drift apart one edit at a time.
        function verticalBars(canvas, rows, colour) {
            if (!canvas || !rows || !rows.length) { return; }
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: rows.map(function (d) { return d.label; }),
                    datasets: [{
                        label: 'Residents',
                        data: rows.map(function (d) { return d.value; }),
                        backgroundColor: colour,
                        borderRadius: 4,
                        maxBarThickness: 46
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { color: INK_MUTED, font: CHART_FONT }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: GRIDLINE, drawBorder: false },
                            ticks: { precision: 0, color: INK_MUTED, font: CHART_FONT }
                        }
                    }
                }
            });
        }

        function horizontalBars(canvas, rows, colour) {
            if (!canvas || !rows || !rows.length) { return; }
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: rows.map(function (d) { return d.label; }),
                    datasets: [{
                        label: 'Residents',
                        data: rows.map(function (d) { return d.value; }),
                        backgroundColor: colour,
                        borderRadius: 4,
                        maxBarThickness: 20
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 30 } },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: GRIDLINE, drawBorder: false },
                            ticks: { precision: 0, color: INK_MUTED, font: CHART_FONT }
                        },
                        y: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                color: INK_MUTED,
                                font: CHART_FONT,
                                autoSkip: false,
                                callback: function (value) {
                                    return shortLabel(this.getLabelForValue(value), 18);
                                }
                            }
                        }
                    }
                },
                plugins: [barValueLabels]
            });
        }

        function ringChart(canvas, rows) {
            if (!canvas || !rows || !rows.length) { return; }
            var total = rows.reduce(function (sum, d) { return sum + d.value; }, 0);
            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: rows.map(function (d) { return d.label; }),
                    datasets: [{
                        data: rows.map(function (d) { return d.value; }),
                        backgroundColor: SERIES.slice(0, rows.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: pieLegend,
                        tooltip: {
                            callbacks: {
                                label: function (item) {
                                    var share = total ? Math.round((item.parsed / total) * 100) : 0;
                                    return item.label + ': ' + item.parsed + ' (' + share + '%)';
                                }
                            }
                        }
                    }
                }
            });
        }

        verticalBars(document.getElementById('chart-age'), data.age_groups, SERIES[0]);
        ringChart(document.getElementById('chart-gender'), data.gender_mix);
        ringChart(document.getElementById('chart-priority'), data.priority_groups);
        horizontalBars(document.getElementById('chart-occupation'), data.occupations, SERIES[1]);
        horizontalBars(document.getElementById('chart-purok'), data.purok_mix, SERIES[3]);
        verticalBars(document.getElementById('chart-household'), data.household, SERIES[2]);
    })
    .catch(function (err) {
        console.error('Failed to load dashboard chart data', err);
        var mixHost = document.getElementById('question-mix');
        if (mixHost) {
            mixHost.innerHTML = '<div class="db-empty">Chart data could not be loaded. Refresh the page to try again.</div>';
        }
    });
</script>

<script>
// Re-fetch just the trend series when a different period is chosen. Nothing
// else on the dashboard depends on the window, so the page need not reload.
(function () {
    var apply = document.getElementById('trend-apply');
    var reset = document.getElementById('trend-reset');
    if (!apply) { return; }

    var fromInput = document.getElementById('trend-from');
    var toInput = document.getElementById('trend-to');

    function load(from, to) {
        fetch('ajax_stats.php?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var chart = window.trendChart;
                if (!chart || !data.response_trend) { return; }
                chart.data.labels = data.response_trend.map(function (d) { return d.label; });
                chart.data.datasets[0].data = data.response_trend.map(function (d) { return d.value; });
                chart.update();
            })
            .catch(function () { /* leave the previous view in place */ });
    }

    apply.addEventListener('click', function () {
        if (!fromInput.value || !toInput.value) { return; }
        load(fromInput.value, toInput.value);
    });

    reset.addEventListener('click', function () {
        var to = new Date();
        var from = new Date();
        from.setDate(from.getDate() - 29);
        toInput.value = to.toISOString().slice(0, 10);
        fromInput.value = from.toISOString().slice(0, 10);
        load(fromInput.value, toInput.value);
    });
})();
</script>

<?php require_once '../includes/footer.php'; ?>
