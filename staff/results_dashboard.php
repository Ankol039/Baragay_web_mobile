<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Results Dashboard';
$asset_path = '../';

$surveys = $conn->query("SELECT survey_id, title FROM surveys ORDER BY created_at DESC");
$survey_id = (int)($_GET['survey_id'] ?? 0);

$survey = null;
$questions = [];
$total_respondents = 0;

if ($survey_id) {
    $stmt = $conn->prepare("SELECT * FROM surveys WHERE survey_id = ?");
    $stmt->bind_param('i', $survey_id);
    $stmt->execute();
    $survey = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($survey) {
        $stmt = $conn->prepare("SELECT COUNT(*) c FROM responses WHERE survey_id = ?");
        $stmt->bind_param('i', $survey_id);
        $stmt->execute();
        $total_respondents = $stmt->get_result()->fetch_assoc()['c'];
        $stmt->close();

        $q_result = $conn->query("SELECT * FROM survey_questions WHERE survey_id = $survey_id ORDER BY question_order ASC");
        while ($q = $q_result->fetch_assoc()) {
            $qid = $q['question_id'];

            if ($q['question_type'] === 'multiple_choice') {
                $stmt = $conn->prepare("
                    SELECT c.choice_text, COUNT(sr.answer_id) AS votes
                    FROM survey_choices c
                    LEFT JOIN survey_results sr ON sr.choice_id = c.choice_id
                    WHERE c.question_id = ?
                    GROUP BY c.choice_id, c.choice_text
                ");
                $stmt->bind_param('i', $qid);
                $stmt->execute();
                $q['breakdown'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                $stmt->close();

            } elseif ($q['question_type'] === 'yesno') {
                $stmt = $conn->prepare("SELECT answer_text, COUNT(*) AS votes FROM survey_results WHERE question_id = ? AND answer_text IN ('Yes','No') GROUP BY answer_text");
                $stmt->bind_param('i', $qid);
                $stmt->execute();
                $res = $stmt->get_result();
                
                // Force Yes and No to always appear
                $counts = ['Yes' => 0, 'No' => 0];
                while ($row = $res->fetch_assoc()) {
                    $counts[$row['answer_text']] = (int)$row['votes'];
                }
                $q['breakdown'] = [];
                foreach ($counts as $text => $votes) {
                    $q['breakdown'][] = ['choice_text' => $text, 'votes' => $votes];
                }
                $stmt->close();

            } elseif ($q['question_type'] === 'rating') {
                $stmt = $conn->prepare("SELECT AVG(rating_value) AS avg_rating, COUNT(rating_value) AS n FROM survey_results WHERE question_id = ? AND rating_value IS NOT NULL");
                $stmt->bind_param('i', $qid);
                $stmt->execute();
                $agg = $stmt->get_result()->fetch_assoc();
                $q['avg_rating'] = $agg['avg_rating'] ? round($agg['avg_rating'], 2) : 0;
                $q['rating_n'] = $agg['n'];
                $stmt->close();

                $stmt = $conn->prepare("SELECT rating_value, COUNT(*) AS votes FROM survey_results WHERE question_id = ? AND rating_value IS NOT NULL GROUP BY rating_value ORDER BY rating_value");
                $stmt->bind_param('i', $qid);
                $stmt->execute();
                $res = $stmt->get_result();

                // Force 1 through 5 stars to always appear
                $counts = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
                while ($row = $res->fetch_assoc()) {
                    $counts[(int)$row['rating_value']] = (int)$row['votes'];
                }
                $q['breakdown'] = [];
                foreach ($counts as $val => $votes) {
                    $q['breakdown'][] = ['rating_value' => $val, 'votes' => $votes];
                }
                $stmt->close();

            } else { // short_answer
                // Submission date comes along so the answers can be filtered
                // by period, and the cap is lifted now that they are searchable.
                $stmt = $conn->prepare("
                    SELECT sr.answer_text, r.submitted_at
                    FROM survey_results sr
                    LEFT JOIN responses r ON r.response_id = sr.response_id
                    WHERE sr.question_id = ? AND sr.answer_text IS NOT NULL AND sr.answer_text != ''
                    ORDER BY sr.answer_id DESC
                    LIMIT 200
                ");
                $stmt->bind_param('i', $qid);
                $stmt->execute();
                $q['answers'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                $stmt->close();
            }
            $questions[] = $q;
        }
    }
}

require_once '../includes/header_staff.php';
?>

<div class="page-head">
    <div class="page-head-text">
        <h1>Results</h1>
        <p>Choose a survey to see how residents answered.</p>
    </div>
</div>

<div class="card no-print">
    <form method="GET">
        <label for="survey_id">Select a Survey to View Results</label>
        <select id="survey_id" name="survey_id" onchange="this.form.submit()" style="max-width: 400px;">
            <option value="">-- Choose a survey --</option>
            <?php $surveys->data_seek(0); while ($s = $surveys->fetch_assoc()): ?>
                <option value="<?= (int)$s['survey_id'] ?>" <?= $s['survey_id'] == $survey_id ? 'selected' : '' ?>><?= h($s['title']) ?></option>
            <?php endwhile; ?>
        </select>
    </form>
</div>

<?php if ($survey): ?>

<!-- Summary KPI Cards -->
<div class="grid-2 mb-4">
    <div class="stat-card">
        <div class="stat-number"><?= (int)$total_respondents ?></div>
        <div class="stat-label">Total Respondents</div>
    </div>
    <div class="stat-card">
        <div class="stat-number" style="font-size: 1.4rem; padding-top: 8px;">
            <?= date('M d, Y', strtotime($survey['start_date'])) ?> &mdash; <?= date('M d, Y', strtotime($survey['end_date'])) ?>
        </div>
        <div class="stat-label">Survey Collection Period</div>
    </div>
</div>

<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
            <h2 style="margin-bottom:4px;"><?= h($survey['title']) ?></h2>
            <p style="color:var(--muted);margin-top:0;">
                <span class="badge <?= $survey['status'] === 'active' ? 'badge-active' : 'badge-inactive' ?>">
                    <?= ucfirst(h($survey['status'])) ?>
                </span>
            </p>
        </div>
        <div class="no-print">
            <a class="btn" href="reports.php?survey_id=<?= $survey_id ?>">Printable Report</a>
        </div>
    </div>
</div>

<?php foreach ($questions as $i => $q): ?>
<div class="card">
    <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 20px;">
        <?= ($i + 1) . '. ' . h($q['question_text']) ?>
    </h3>

    <?php if (in_array($q['question_type'], ['multiple_choice', 'yesno'])): ?>
        <?php
            // Calculate max votes to highlight the winning bar
            $max_votes = 0;
            foreach ($q['breakdown'] as $b) { $max_votes = max($max_votes, (int)$b['votes']); }
            $total_votes = array_sum(array_column($q['breakdown'], 'votes'));
        ?>

        <?php // Percentages below are a share of this number, not of all residents. ?>
        <div style="color: var(--muted); font-size: 0.9rem; margin-bottom: 14px;">
            Based on <?= (int)$total_votes ?> response<?= $total_votes === 1 ? '' : 's' ?>.
        </div>

        <div style="max-width: 700px;">
            <?php foreach ($q['breakdown'] as $b): 
                $pct = $total_votes ? round($b['votes'] / $total_votes * 100) : 0; 
                // Highlight the top answer in the accent color
                $bar_color = ($b['votes'] == $max_votes && $max_votes > 0) ? 'var(--accent)' : 'var(--primary)';
            ?>
                <div class="bar-row" style="margin-bottom: 14px;">
                    <div class="bar-label" style="width: 200px; font-weight: 600;"><?= h($b['choice_text']) ?></div>
                    <div class="bar-track" style="height: 24px;">
                        <div class="bar-fill" style="width:<?= $pct ?>%; background-color: <?= $bar_color ?>; transition: width 0.5s ease;"></div>
                    </div>
                    <div class="bar-value" style="width: 80px; text-align: left; padding-left: 10px; font-weight: 600;">
                        <?= $pct ?>% <span style="color:var(--muted); font-size: 0.8rem; font-weight: 400;">(<?= (int)$b['votes'] ?>)</span>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

    <?php elseif ($q['question_type'] === 'rating'): ?>
        <?php
            $max_votes = 0;
            foreach ($q['breakdown'] as $b) { $max_votes = max($max_votes, (int)$b['votes']); }
            $total_votes = array_sum(array_column($q['breakdown'], 'votes'));
        ?>
        
        <div style="margin-bottom: 20px;">
            <span style="font-size: 2rem; font-weight: 700; color: var(--primary);"><?= $q['avg_rating'] ?></span>
            <span style="font-size: 1.2rem; color: var(--muted);">/ 5 Average Rating</span>
            <div style="color: var(--muted); font-size: 0.9rem;">Based on <?= (int)$q['rating_n'] ?> total ratings</div>
        </div>
        
        <div style="max-width: 700px;">
            <?php foreach ($q['breakdown'] as $b): 
                $pct = $total_votes ? round($b['votes'] / $total_votes * 100) : 0; 
                $bar_color = ($b['votes'] == $max_votes && $max_votes > 0) ? 'var(--accent)' : 'var(--primary)';
            ?>
                <div class="bar-row" style="margin-bottom: 12px;">
                    <div class="bar-label" style="width: 100px; font-weight: 600;">
                        <?= (int)$b['rating_value'] ?> Star<?= $b['rating_value'] > 1 ? 's' : '' ?>
                    </div>
                    <div class="bar-track" style="height: 20px;">
                        <div class="bar-fill" style="width:<?= $pct ?>%; background-color: <?= $bar_color ?>; transition: width 0.5s ease;"></div>
                    </div>
                    <div class="bar-value" style="width: 80px; text-align: left; padding-left: 10px; font-weight: 600;">
                        <?= $pct ?>% <span style="color:var(--muted); font-size: 0.8rem; font-weight: 400;">(<?= (int)$b['votes'] ?>)</span>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

    <?php else: ?>
        <!-- Short Answer Cards Layout -->
        <?php if (empty($q['answers'])): ?>
            <p style="color:var(--muted); font-style: italic; background: var(--bg); padding: 16px; border-radius: 8px; text-align: center;">No text responses have been submitted yet.</p>
        <?php else: ?>
            <?php $scope_id = 'answers-' . (int)$q['question_id']; ?>
            <div class="table-toolbar no-print">
                <input type="search" data-answer-search="<?= $scope_id ?>"
                       placeholder="Search these answers..."
                       aria-label="Search the open-text answers to this question">
            </div>

            <div id="<?= $scope_id ?>" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                <?php foreach ($q['answers'] as $a): ?>
                    <div data-answer-text="<?= h($a['answer_text']) ?>"
                         style="background: var(--bg); padding: 16px; border-radius: 8px; border-left: 4px solid var(--primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <p style="margin: 0; font-size: 0.95rem; color: var(--text);">"<?= h($a['answer_text']) ?>"</p>
                        <?php if (!empty($a['submitted_at'])): ?>
                            <p class="muted-note" style="margin:8px 0 0;"><?= h(date('M j, Y', strtotime($a['submitted_at']))) ?></p>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            <p class="answer-no-match empty-state" style="display:none;">No answers match your search.</p>
        <?php endif; ?>
    <?php endif; ?>
</div>
<?php endforeach; ?>

<?php elseif ($survey_id): ?>
    <div class="alert alert-error">Survey not found.</div>
<?php else: ?>
<!-- Nothing chosen yet: fill the blank area with a deliberate empty state
     instead of leaving the page looking unfinished. -->
<div class="card">
    <div class="empty-panel">
        <span class="empty-panel-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" x2="18" y1="20" y2="10"/>
                <line x1="12" x2="12" y1="20" y2="4"/>
                <line x1="6" x2="6" y1="20" y2="14"/>
                <line x1="3" x2="21" y1="21" y2="21"/>
            </svg>
        </span>
        <h3>No Result Selected</h3>
        <p>Pick a survey from the dropdown above to view its response breakdown and charts.</p>
    </div>
</div>
<?php endif; ?>

<?php require_once '../includes/footer.php'; ?>