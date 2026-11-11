<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

$page_title = 'Dashboard';
$asset_path = '../';
$resident_id = $_SESSION['resident_id'];

// Count available (open, not yet answered) surveys
$stmt = $conn->prepare("
    SELECT COUNT(*) AS cnt FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?)
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$available_count = $stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

// Count surveys already answered by this resident
$stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM responses WHERE resident_id = ?");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$answered_count = $stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

// Surveys closing soonest that this resident has not answered yet — gives the
// side column real content instead of leaving the row half empty.
$upcoming = [];
$stmt = $conn->prepare("
    SELECT s.survey_id, s.title, s.end_date FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?)
    ORDER BY s.end_date ASC LIMIT 5
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) { $upcoming[] = $row; }
$stmt->close();

/* ------------------------------------------------------------
   The resident's own record, read fresh so a change made by staff
   shows without a re-login. SELECT * rather than a column list:
   the address parts are added by the migration in config/db.php,
   and an older installation should degrade to a blank field
   instead of a fatal error.
   ------------------------------------------------------------ */
$me = [];
$stmt = $conn->prepare("SELECT * FROM residents WHERE resident_id = ?");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$me = $stmt->get_result()->fetch_assoc() ?: [];
$stmt->close();

$residency_status = ($me['residency_status'] ?? 'permanent') === 'temporary' ? 'temporary' : 'permanent';
$is_temporary = ($residency_status === 'temporary');
$residence_code = (string)($me['residence_type'] ?? '');
$residence_name = function_exists('residence_type_label') ? residence_type_label($residence_code) : '';

/* ----------------------------------------------------------------------------
   Personal figures for the dashboard charts.

   These use the household details staff recorded on this resident's own record
   and the resident's own submissions. Nothing here reaches across to anybody
   else's data — a resident sees their household and their activity, not the
   barangay's.
   ---------------------------------------------------------------------------- */

// Submissions per month over the last six months, including the empty ones so
// a quiet month reads as a gap rather than being left out of the chart.
$activity_months = [];
$month_counts = [];
$stmt = $conn->prepare("
    SELECT DATE_FORMAT(submitted_at, '%Y-%m') AS ym, COUNT(*) AS cnt
    FROM responses
    WHERE resident_id = ? AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
    GROUP BY ym
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $month_counts[$row['ym']] = (int)$row['cnt'];
}
$stmt->close();
for ($i = 5; $i >= 0; $i--) {
    $key = date('Y-m', strtotime("-{$i} month"));
    $activity_months[] = [
        'label' => date('M Y', strtotime($key . '-01')),
        'value' => $month_counts[$key] ?? 0,
    ];
}
$has_activity = $answered_count > 0;

// Who else is on this resident's record.
$my_children   = fetch_person_rows($conn, 'resident_children', (int)$resident_id);
$my_references = fetch_person_rows($conn, 'resident_character_references', (int)$resident_id);
$my_is_married = (int)($me['is_married'] ?? 0) === 1;

$household_rows = [];
if ($my_is_married)          { $household_rows[] = ['label' => 'Spouse',    'value' => 1]; }
if (count($my_children))     { $household_rows[] = ['label' => 'Children',  'value' => count($my_children)]; }
if (count($my_references))   { $household_rows[] = ['label' => 'References','value' => count($my_references)]; }
$has_household = !empty($household_rows);

/* How long they have been residing here, and — for a temporary resident — how
   far that is through the minimum before permanent status can be recorded.
   A permanent resident has already passed it, so theirs simply reads as full. */
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
$residency_pct = $is_temporary
    ? min(100, (int)round(($residency_months / max(1, $residency_minimum)) * 100))
    : 100;
$has_residency_progress = !empty($me['residency_start_date']);

// The resident's own most recent submissions.
$recent_submissions = [];
$stmt = $conn->prepare("
    SELECT s.title, r.submitted_at
    FROM responses r
    JOIN surveys s ON s.survey_id = r.survey_id
    WHERE r.resident_id = ?
    ORDER BY r.submitted_at DESC
    LIMIT 5
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) { $recent_submissions[] = $row; }
$stmt->close();

// Figures for the overview panel
$assigned_total = (int)$available_count + (int)$answered_count;
$completion_pct = $assigned_total > 0 ? (int)round(((int)$answered_count / $assigned_total) * 100) : 0;
$next_deadline = $upcoming ? $upcoming[0]['end_date'] : null;
$days_left = $next_deadline
    ? (int)floor((strtotime($next_deadline) - strtotime('today')) / 86400)
    : null;

/** One address part, or a dash when the field was left blank. */
function db_part($row, $key) {
    $value = trim((string)($row[$key] ?? ''));
    return $value !== '' ? $value : '—';
}

require_once '../includes/header_resident.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Welcome, <?= h($_SESSION['resident_name']) ?>!</h1>
        <p>Here's a quick look at your survey activity.</p>
    </div>
</div>

<!-- Action sits below the heading rule so it does not crowd the account menu -->
<div class="page-actions-row">
    <a class="btn" href="surveys.php">Answer a Survey</a>
</div>

<div class="alert alert-info">
    <strong>Reminder:</strong> Please complete available surveys before their closing date. Your responses help improve barangay health services.
</div>

<?php /* ---------- Metric strip ---------- */ ?>
<div class="db-strip" style="margin-top:18px;">
    <a class="db-cell" href="stat_detail.php?view=available">
        <span class="db-cell-label">Waiting for You</span>
        <span class="db-cell-value"><?= (int)$available_count ?></span>
        <span class="db-cell-foot"><?= $available_count > 0 ? 'Open and not yet answered' : 'Nothing pending right now' ?></span>
    </a>
    <a class="db-cell" href="stat_detail.php?view=completed">
        <span class="db-cell-label">Completed</span>
        <span class="db-cell-value"><?= (int)$answered_count ?></span>
        <span class="db-cell-foot">Answers already recorded</span>
    </a>
    <a class="db-cell" href="stat_detail.php?view=assigned">
        <span class="db-cell-label">Assigned to You</span>
        <span class="db-cell-value"><?= (int)$assigned_total ?></span>
        <span class="db-cell-foot"><?= (int)$completion_pct ?>% completed</span>
    </a>
    <span class="db-cell">
        <span class="db-cell-label">Next Closing Date</span>
        <span class="db-cell-value db-value-sm"><?= $next_deadline ? h(date('M j, Y', strtotime($next_deadline))) : 'None' ?></span>
        <span class="db-cell-foot">
            <?php if ($days_left !== null && $days_left <= 3): ?>
                <span class="db-delta is-down"><?= $days_left <= 0 ? 'Closes today' : $days_left . ' day' . ($days_left === 1 ? '' : 's') . ' left' ?></span>
            <?php elseif ($days_left !== null): ?>
                <?= (int)$days_left ?> days left
            <?php else: ?>
                No surveys closing soon
            <?php endif; ?>
        </span>
    </span>
</div>

<?php /* ---------- Row 1: progress ring, overview, residency ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-panel-primary db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Your Progress</h3>
                <p class="db-panel-note">Surveys you have answered out of those assigned to you.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-completion"></canvas></div>
            <ul class="db-kv" style="margin-top:8px;">
                <li><span class="db-kv-key">Completed</span><span class="db-kv-val"><?= (int)$answered_count ?></span></li>
                <li><span class="db-kv-key">Still to answer</span><span class="db-kv-val"><?= (int)$available_count ?></span></li>
            </ul>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div><h3 class="db-panel-title">Survey Overview</h3></div>
        </div>
        <div class="db-panel-body">
            <div class="overview-progress">
                <span style="width: <?= $completion_pct ?>%"></span>
            </div>
            <span class="meter-note"><?= (int)$answered_count ?> of <?= $assigned_total ?> surveys completed (<?= $completion_pct ?>%)</span>

            <ul class="overview-list" style="margin-top:12px;">
                <li>
                    <span class="overview-icon"><?= nav_icon('surveys') ?></span>
                    <span class="overview-text">
                        <strong><?= (int)$available_count ?> waiting for your answer</strong>
                        <span><?= $available_count > 0 ? 'Open now and not yet answered.' : 'Nothing pending right now.' ?></span>
                    </span>
                </li>
                <li>
                    <span class="overview-icon"><?= nav_icon('check') ?></span>
                    <span class="overview-text">
                        <strong><?= (int)$answered_count ?> already submitted</strong>
                        <span>Your answers are recorded and cannot be changed.</span>
                    </span>
                </li>
                <li>
                    <span class="overview-icon"><?= nav_icon('clock') ?></span>
                    <span class="overview-text">
                        <strong><?= $next_deadline ? h(date('M j, Y', strtotime($next_deadline))) : 'No upcoming deadline' ?></strong>
                        <span><?= $next_deadline ? 'Closing date of your next survey.' : 'You have no surveys closing soon.' ?></span>
                    </span>
                </li>
            </ul>
        </div>
    </div>

    <?php if ($is_temporary): ?>
    <?php /* ============================================================
            Temporary resident. Two addresses are on file, so the panel
            leads with where the health center currently expects to find
            them and keeps the permanent address underneath.
            ============================================================ */ ?>
    <div class="db-panel db-panel-accent db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Where You Are Staying</h3>
                <p class="db-panel-note">The address the health center uses to reach you now.</p>
            </div>
            <span class="db-pill db-pill-temporary">Temporary</span>
        </div>
        <div class="db-panel-body">
            <?php if ($residence_name !== ''): ?>
            <div class="db-address-line">
                <strong><?= h($residence_code) ?> &middot; <?= h($residence_name) ?></strong><br>
                <?= trim((string)($me['temporary_address'] ?? '')) !== '' ? h($me['temporary_address']) : 'No temporary address recorded yet.' ?>
            </div>
            <?php else: ?>
            <div class="db-address-line">
                <?= trim((string)($me['temporary_address'] ?? '')) !== '' ? h($me['temporary_address']) : 'No temporary address recorded yet.' ?>
            </div>
            <?php endif; ?>

            <dl class="db-facts">
                <div class="db-fact"><dt>Barangay</dt><dd><?= h(db_part($me, 'temp_barangay')) ?></dd></div>
                <div class="db-fact"><dt>Municipality / City</dt><dd><?= h(db_part($me, 'temp_municipality')) ?></dd></div>
                <div class="db-fact"><dt>Province</dt><dd><?= h(db_part($me, 'temp_province')) ?></dd></div>
            </dl>

            <?php // Stacked, not a key/value row: a full address line is far too
                  // long to sit opposite its own label without colliding with it. ?>
            <dl class="db-facts" style="margin-top:14px;">
                <div class="db-fact">
                    <dt>Permanent Address</dt>
                    <dd><?= trim((string)($me['address'] ?? '')) !== '' ? h($me['address']) : '—' ?></dd>
                </div>
            </dl>

            <p class="db-panel-note" style="margin-top:12px;">
                Address changes are reviewed by barangay staff. Request one from
                <a href="profile.php">My Profile</a>.
            </p>
        </div>
    </div>
    <?php else: ?>
    <?php /* ---------- Permanent resident: one address on file ---------- */ ?>
    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Your Registered Address</h3>
                <p class="db-panel-note">Where the health center has you on record.</p>
            </div>
            <span class="db-pill db-pill-permanent">Permanent</span>
        </div>
        <div class="db-panel-body">
            <div class="db-address-line">
                <?= trim((string)($me['address'] ?? '')) !== '' ? h($me['address']) : 'No address recorded yet.' ?>
            </div>

            <dl class="db-facts">
                <div class="db-fact"><dt>Household Number</dt><dd><?= h(db_part($me, 'household_number')) ?></dd></div>
                <div class="db-fact"><dt>Barangay</dt><dd><?= h(db_part($me, 'barangay')) ?></dd></div>
                <div class="db-fact"><dt>Municipality / City</dt><dd><?= h(db_part($me, 'municipality')) ?></dd></div>
                <div class="db-fact"><dt>Province</dt><dd><?= h(db_part($me, 'province')) ?></dd></div>
            </dl>

            <p class="db-panel-note" style="margin-top:14px;">
                Address changes are reviewed by barangay staff. Request one from
                <a href="profile.php">My Profile</a>.
            </p>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php
/* ---------- Row 2: the resident's own activity, household and residency ----
   Each panel is left out when it has nothing behind it, so a newly created
   account shows a shorter dashboard rather than a row of empty frames. */
?>
<?php if ($has_activity || $has_household || $has_residency_progress): ?>
<div class="db-grid">
    <?php if ($has_activity): ?>
    <div class="db-panel db-c5">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Your Activity</h3>
                <p class="db-panel-note">Surveys you submitted over the last six months.</p>
            </div>
            <span class="db-panel-meta"><?= (int)$answered_count ?> in total</span>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-md"><canvas id="chart-activity"></canvas></div>
        </div>
    </div>
    <?php endif; ?>

    <?php if ($has_residency_progress): ?>
    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title"><?= $is_temporary ? 'Towards Permanent Status' : 'Your Residency' ?></h3>
                <?php if ($is_temporary): ?>
                <?php /* Only the temporary panel carries a note: it has to explain what
                          the gauge is counting towards. Once a resident is permanent the
                          heading and the dates below say everything, so the line was
                          repeating the panel back to itself. */ ?>
                <p class="db-panel-note">
                    Months completed of the <?= (int)$residency_minimum ?> needed before permanent status can be recorded.
                </p>
                <?php endif; ?>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-xs db-chart-gauge"><canvas id="chart-residency-progress"></canvas></div>
            <ul class="db-kv" style="margin-top:6px;">
                <li>
                    <span class="db-kv-key">Residing here since</span>
                    <span class="db-kv-val"><?= h(date('M j, Y', strtotime($me['residency_start_date']))) ?></span>
                </li>
                <li>
                    <span class="db-kv-key">Months completed</span>
                    <span class="db-kv-val"><?= (int)$residency_months ?></span>
                </li>
                <?php if ($is_temporary): ?>
                <li>
                    <span class="db-kv-key">Still to go</span>
                    <span class="db-kv-val"><?= max(0, (int)$residency_minimum - (int)$residency_months) ?> month(s)</span>
                </li>
                <?php endif; ?>
            </ul>
            <?php if ($is_temporary): ?>
            <p class="db-panel-note" style="margin-top:8px;">
                Reaching the minimum does not change your status on its own &mdash; barangay staff record it.
            </p>
            <?php endif; ?>
        </div>
    </div>
    <?php endif; ?>

    <?php if ($has_household): ?>
    <div class="db-panel db-c3">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">On Your Record</h3>
                <p class="db-panel-note">People recorded alongside you.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <div class="db-chart db-chart-sm"><canvas id="chart-household-mine"></canvas></div>
        </div>
    </div>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php /* ---------- Row 3: closing soon + recent submissions ---------- */ ?>
<div class="db-grid">
    <div class="db-panel db-c8">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Surveys Closing Soon</h3>
                <p class="db-panel-note">Open surveys you have not answered, soonest deadline first.</p>
            </div>
            <span class="db-panel-meta"><?= count($upcoming) ?> open</span>
        </div>
        <div class="db-panel-body">
            <div class="db-table-wrap">
                <table>
                    <tr><th>Survey</th><th>Closes On</th><th>Action</th></tr>
                    <?php if (!$upcoming): ?>
                    <tr><td colspan="3" class="empty-state">You're all caught up &mdash; no pending surveys.</td></tr>
                    <?php endif; ?>
                    <?php foreach ($upcoming as $u): ?>
                    <tr>
                        <td><?= h($u['title']) ?></td>
                        <td><?= h(date('M j, Y', strtotime($u['end_date']))) ?></td>
                        <td><a class="btn-action btn-action-primary" href="survey_form.php?id=<?= (int)$u['survey_id'] ?>" title="Answer Survey"><?= nav_icon('surveys') ?></a></td>
                    </tr>
                    <?php endforeach; ?>
                </table>
            </div>
        </div>
    </div>

    <div class="db-panel db-c4">
        <div class="db-panel-head">
            <div>
                <h3 class="db-panel-title">Recently Submitted</h3>
                <p class="db-panel-note">Your last few answers.</p>
            </div>
        </div>
        <div class="db-panel-body">
            <?php if (!$recent_submissions): ?>
            <div class="db-empty">You haven't submitted a survey yet. Start with one from Available Surveys.</div>
            <?php else: ?>
            <ul class="db-rank">
                <?php foreach ($recent_submissions as $i => $r): ?>
                <li>
                    <span class="db-rank-pos"><?= nav_icon('check') ?></span>
                    <span class="db-rank-name">
                        <?= h($r['title']) ?>
                        <span class="db-rank-sub"><?= h(date('M j, Y', strtotime($r['submitted_at']))) ?></span>
                    </span>
                </li>
                <?php endforeach; ?>
            </ul>
            <a class="view-all-link" href="history.php" style="display:inline-block;margin-top:10px;">View all submissions</a>
            <?php endif; ?>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script>
// AJAX-loaded personal completion stats (fetched from ajax_stats.php, rendered with Chart.js)
var CHART_FONT = { family: "'Segoe UI', Roboto, Arial, sans-serif", size: 12 };
var INK = '#223028';
var INK_MUTED = '#6b7c76';

/** Writes the completion figure into the hole of the ring. */
function centreText(main, sub) {
    return {
        id: 'centreText',
        afterDraw: function (chart) {
            var area = chart.chartArea;
            if (!area) { return; }
            var ctx = chart.ctx;
            var x = (area.left + area.right) / 2;
            var y = (area.top + area.bottom) / 2;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = INK;
            ctx.font = '700 28px ' + CHART_FONT.family;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(main, x, y + 4);

            ctx.fillStyle = INK_MUTED;
            ctx.font = '600 11px ' + CHART_FONT.family;
            ctx.textBaseline = 'top';
            ctx.fillText(sub, x, y + 12);
            ctx.restore();
        }
    };
}

fetch('ajax_stats.php')
    .then(function (r) { return r.json(); })
    .then(function (data) {
        var canvas = document.getElementById('chart-completion');
        if (!canvas) { return; }

        var completed = data.completion[0] ? data.completion[0].value : 0;
        var available = data.completion[1] ? data.completion[1].value : 0;
        var total = completed + available;
        var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: data.completion.map(function (d) { return d.label; }),
                datasets: [{
                    data: data.completion.map(function (d) { return d.value; }),
                    backgroundColor: ['#1d6f5e', '#dbe5e1'],

                    // No spacing, no border, no rounded ends: the two segments
                    // meet edge to edge so the ring reads as one solid circle.
                    spacing: 0,
                    borderWidth: 0,
                    borderRadius: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',

                // Minimal padding so the circle fills the card
                layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            boxPadding: 6,
                            color: INK,
                            font: CHART_FONT
                        }
                    },
                    tooltip: {
                        padding: 10,
                        boxPadding: 6,
                        displayColors: true
                    }
                }
            },
            plugins: [centreText(pct + '%', 'completed')]
        });
    })
    .catch(function (err) { console.error('Failed to load chart data', err); });

/* ============================================================================
   The resident's own activity, residency progress and household.

   These read figures already worked out on the server, so there is no second
   round trip and nothing to fail after the page has drawn. Each block checks
   for its canvas first, because a panel is left out entirely when it has
   nothing to show.
   ============================================================================ */
(function () {
    var SERIES = ['#1d6f5e', '#2f6da9', '#f2a541', '#75c79d'];
    var GRIDLINE = '#e9efec';

    var activityCanvas = document.getElementById('chart-activity');
    if (activityCanvas) {
        var activity = <?= json_encode($activity_months, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
        new Chart(activityCanvas, {
            type: 'bar',
            data: {
                labels: activity.map(function (d) { return d.label; }),
                datasets: [{
                    label: 'Submitted',
                    data: activity.map(function (d) { return d.value; }),
                    backgroundColor: SERIES[0],
                    borderRadius: 4,
                    maxBarThickness: 34
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

    // A half ring, so the figure sits above the flat edge the way a gauge reads.
    var progressCanvas = document.getElementById('chart-residency-progress');
    if (progressCanvas) {
        var pctDone = <?= (int)$residency_pct ?>;
        new Chart(progressCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{
                    data: [pctDone, Math.max(0, 100 - pctDone)],
                    backgroundColor: [SERIES[0], '#dbe5e1'],
                    spacing: 0,
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                rotation: 270,
                circumference: 180,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            },
            plugins: [centreText(pctDone + '%', <?= $is_temporary ? "'of the minimum'" : "'registered'" ?>)]
        });
    }

    var householdCanvas = document.getElementById('chart-household-mine');
    if (householdCanvas) {
        var household = <?= json_encode($household_rows, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
        new Chart(householdCanvas, {
            type: 'doughnut',
            data: {
                labels: household.map(function (d) { return d.label; }),
                datasets: [{
                    data: household.map(function (d) { return d.value; }),
                    backgroundColor: SERIES.slice(0, household.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
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
                    }
                }
            }
        });
    }
})();
</script>

<?php require_once '../includes/footer.php'; ?>
