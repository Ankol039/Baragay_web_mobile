<?php
/** Source: staff/ajax_stats.php, including its date validation and zero filling. */
function api_staff_stats(mysqli $conn): void {
    api_staff_user($conn);
// Responses received per survey (most recent 8 surveys)
$responses_per_survey = [];
$res = $conn->query("
    SELECT s.title, COUNT(r.response_id) AS cnt
    FROM surveys s
    LEFT JOIN responses r ON r.survey_id = s.survey_id
    GROUP BY s.survey_id, s.title
    ORDER BY s.created_at DESC
    LIMIT 8
");
while ($row = $res->fetch_assoc()) {
    $responses_per_survey[] = ['label' => $row['title'], 'value' => (int)$row['cnt']];
}

// Active vs inactive surveys
$survey_status = [];
$res = $conn->query("SELECT status, COUNT(*) c FROM surveys GROUP BY status");
while ($row = $res->fetch_assoc()) {
    $survey_status[] = ['label' => ucfirst($row['status']), 'value' => (int)$row['c']];
}

// Responses per day for the last 30 days. Totals alone hide whether
// participation is climbing or dying, which is what this chart answers.
$response_trend = [];
$trend_map = [];

// The window defaults to the last 30 days; the dashboard can ask for any
// other period through ?from=YYYY-MM-DD&to=YYYY-MM-DD.
$valid_date = function ($value) {
    $value = is_string($value) ? $value : '';
    $parsed = DateTime::createFromFormat('Y-m-d', $value);
    return ($parsed && $parsed->format('Y-m-d') === $value) ? $value : null;
};
$trend_to   = $valid_date($_GET['to'] ?? '')   ?? date('Y-m-d');
$trend_from = $valid_date($_GET['from'] ?? '') ?? date('Y-m-d', strtotime('-29 day', strtotime($trend_to)));
if ($trend_from > $trend_to) {
    [$trend_from, $trend_to] = [$trend_to, $trend_from];
}
// A year of daily points is already more than the chart can show legibly.
$span_days = (int)floor((strtotime($trend_to) - strtotime($trend_from)) / 86400);
if ($span_days > 365) {
    $trend_from = date('Y-m-d', strtotime('-365 day', strtotime($trend_to)));
    $span_days = 365;
}

$trend_stmt = $conn->prepare("
    SELECT DATE(submitted_at) AS d, COUNT(*) AS cnt
    FROM responses
    WHERE DATE(submitted_at) BETWEEN ? AND ?
    GROUP BY DATE(submitted_at)
");
$trend_stmt->bind_param('ss', $trend_from, $trend_to);
$trend_stmt->execute();
$res = $trend_stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $trend_map[$row['d']] = (int)$row['cnt'];
}
$trend_stmt->close();

// Fill gaps so days with zero responses still render as a flat point
for ($i = $span_days; $i >= 0; $i--) {
    $day = date('Y-m-d', strtotime("-$i day", strtotime($trend_to)));
    $response_trend[] = [
        'label' => date('M j', strtotime($day)),
        'value' => $trend_map[$day] ?? 0,
    ];
}

// Permanent vs temporary residents. The split decides which resident
// dashboard a person is shown, so the staff overview reports it.
$residency_mix = [];
$permanent = 0;
$temporary = 0;
$res = $conn->query("SELECT residency_status, COUNT(*) c FROM residents WHERE deleted_at IS NULL GROUP BY residency_status");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        if ($row['residency_status'] === 'temporary') {
            $temporary += (int)$row['c'];
        } else {
            // Anything that is not explicitly temporary counts as permanent,
            // which is also the column's default.
            $permanent += (int)$row['c'];
        }
    }
}
$residency_mix[] = ['label' => 'Permanent', 'value' => $permanent];
$residency_mix[] = ['label' => 'Temporary', 'value' => $temporary];

// Which question types the surveys actually use.
$question_types = [];
$type_labels = [
    'multiple_choice' => 'Multiple Choice',
    'yesno'           => 'Yes / No',
    'rating'          => 'Rating Scale',
    'short_answer'    => 'Short Answer',
];
$res = $conn->query("SELECT question_type, COUNT(*) c FROM survey_questions GROUP BY question_type ORDER BY c DESC");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $key = $row['question_type'];
        $question_types[] = [
            'label' => $type_labels[$key] ?? ucwords(str_replace('_', ' ', $key)),
            'value' => (int)$row['c'],
        ];
    }
}

/* ==========================================================================
   Resident demographics.

   These read the household details collected on the Add Resident form —
   birthdate, gender, priority category, occupation, purok, and the marital
   and children answers — so the figures already being typed in are worth
   something back to the people entering them.

   Every query is scoped to `deleted_at IS NULL`, so a resident who has been
   removed stops counting the moment they are deleted rather than quietly
   inflating the barangay's figures.
   ========================================================================== */

// Age bands, worked out in SQL from the birthdate so no stored age can drift.
$age_groups = [];
$age_bands = [
    'Under 18' => 'age < 18',
    '18 - 34'  => 'age BETWEEN 18 AND 34',
    '35 - 59'  => 'age BETWEEN 35 AND 59',
    '60 and over' => 'age >= 60',
];
$res = $conn->query("
    SELECT
        SUM(CASE WHEN age < 18 THEN 1 ELSE 0 END)            AS band_child,
        SUM(CASE WHEN age BETWEEN 18 AND 34 THEN 1 ELSE 0 END) AS band_young,
        SUM(CASE WHEN age BETWEEN 35 AND 59 THEN 1 ELSE 0 END) AS band_mid,
        SUM(CASE WHEN age >= 60 THEN 1 ELSE 0 END)            AS band_senior
    FROM (
        SELECT TIMESTAMPDIFF(YEAR, birthdate, CURDATE()) AS age
        FROM residents
        WHERE deleted_at IS NULL AND birthdate IS NOT NULL
    ) aged
");
if ($res && ($row = $res->fetch_assoc())) {
    $age_groups = [
        ['label' => 'Under 18',    'value' => (int)$row['band_child']],
        ['label' => '18 - 34',     'value' => (int)$row['band_young']],
        ['label' => '35 - 59',     'value' => (int)$row['band_mid']],
        ['label' => '60 and over', 'value' => (int)$row['band_senior']],
    ];
}

// Gender mix. Anything not recorded is shown rather than dropped, so the
// chart adds up to the number of residents on file.
$gender_mix = [];
$gender_labels = gender_options();
$gender_counts = [];
$res = $conn->query("
    SELECT COALESCE(NULLIF(gender, ''), 'unstated') AS g, COUNT(*) c
    FROM residents WHERE deleted_at IS NULL GROUP BY g
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $gender_counts[$row['g']] = (int)$row['c'];
    }
}
foreach ($gender_labels as $key => $label) {
    if (!empty($gender_counts[$key])) {
        $gender_mix[] = ['label' => $label, 'value' => $gender_counts[$key]];
    }
}
if (!empty($gender_counts['unstated'])) {
    $gender_mix[] = ['label' => 'Not recorded', 'value' => $gender_counts['unstated']];
}

// Priority groups the health centre plans around.
$priority_groups = [];
$category_labels = [
    'pwd'            => 'PWD',
    'senior_citizen' => 'Senior Citizen',
    'pregnant'       => 'Pregnant',
    'none'           => 'No priority group',
];
$category_counts = [];
$res = $conn->query("
    SELECT COALESCE(NULLIF(special_category, ''), 'none') AS cat, COUNT(*) c
    FROM residents WHERE deleted_at IS NULL GROUP BY cat
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $category_counts[$row['cat']] = (int)$row['c'];
    }
}
foreach ($category_labels as $key => $label) {
    if (!empty($category_counts[$key])) {
        $priority_groups[] = ['label' => $label, 'value' => $category_counts[$key]];
    }
}

// Occupations people actually typed in, most common first.
$occupations = [];
$res = $conn->query("
    SELECT TRIM(occupation) AS job, COUNT(*) c
    FROM residents
    WHERE deleted_at IS NULL
      AND occupation IS NOT NULL
      AND TRIM(occupation) <> ''
      AND UPPER(TRIM(occupation)) NOT IN ('N/A', 'NA', 'NONE')
    GROUP BY UPPER(TRIM(occupation))
    ORDER BY c DESC, job ASC
    LIMIT 7
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $occupations[] = ['label' => $row['job'], 'value' => (int)$row['c']];
    }
}

// Where in the barangay people live.
$purok_mix = [];
$res = $conn->query("
    SELECT TRIM(purok) AS area, COUNT(*) c
    FROM residents
    WHERE deleted_at IS NULL AND purok IS NOT NULL AND TRIM(purok) <> ''
    GROUP BY UPPER(TRIM(purok))
    ORDER BY c DESC, area ASC
    LIMIT 7
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $purok_mix[] = ['label' => $row['area'], 'value' => (int)$row['c']];
    }
}

// Household make-up, from the married and children answers.
$household = [];
$res = $conn->query("
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_married = 1 THEN 1 ELSE 0 END)   AS married,
        SUM(CASE WHEN has_children = 1 THEN 1 ELSE 0 END) AS with_children
    FROM residents WHERE deleted_at IS NULL
");
if ($res && ($row = $res->fetch_assoc())) {
    $total_households = (int)$row['total'];
    $married = (int)$row['married'];
    $with_children = (int)$row['with_children'];
    $household = [
        ['label' => 'Married',      'value' => $married],
        ['label' => 'Not married',  'value' => max(0, $total_households - $married)],
        ['label' => 'With children','value' => $with_children],
        ['label' => 'No children',  'value' => max(0, $total_households - $with_children)],
    ];
}

api_json(['ok' => true, 'data' => [
    'responses_per_survey' => $responses_per_survey,
    'survey_status' => $survey_status,
    'response_trend' => $response_trend,
    'residency_mix' => $residency_mix,
    'question_types' => $question_types,
    'age_groups' => $age_groups,
    'gender_mix' => $gender_mix,
    'priority_groups' => $priority_groups,
    'occupations' => $occupations,
    'purok_mix' => $purok_mix,
    'household' => $household,
]]);
}
