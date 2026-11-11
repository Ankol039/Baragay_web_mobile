<?php
/** Exact loaders from staff/results_dashboard.php and reports.php. */
function api_report_survey_id(): int {
    return is_scalar($_GET['survey_id'] ?? 0) ? (int)($_GET['survey_id'] ?? 0) : 0;
}

function api_staff_results(mysqli $conn): void {
    api_staff_user($conn);
$surveys = $conn->query("SELECT survey_id, title FROM surveys ORDER BY created_at DESC");
$survey_id = api_report_survey_id();

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


$surveys = $surveys->fetch_all(MYSQLI_ASSOC);
if ($survey) {
    $survey = array_intersect_key($survey, array_flip(['survey_id', 'title', 'description', 'start_date', 'end_date', 'status', 'created_by_name']));
    $survey['period_label'] = date('M d, Y', strtotime($survey['start_date'])) . ' — ' . date('M d, Y', strtotime($survey['end_date']));
}
foreach ($questions as &$q) {
    if (isset($q['breakdown'])) {
        $total_votes = array_sum(array_column($q['breakdown'], 'votes'));
        $max_votes = max(array_merge([0], array_column($q['breakdown'], 'votes')));
        $q['total_votes'] = (int)$total_votes;
        foreach ($q['breakdown'] as &$b) {
            $b['votes'] = (int)$b['votes'];
            $b['percent'] = $total_votes ? (int)round($b['votes'] / $total_votes * 100) : 0;
            $b['winning'] = $b['votes'] == $max_votes && $max_votes > 0;
        }
        unset($b);
    }
    if (isset($q['answers'])) {
        foreach ($q['answers'] as &$answer) {
            $answer['submitted_at_label'] = !empty($answer['submitted_at']) ? date('M j, Y', strtotime($answer['submitted_at'])) : '';
        }
        unset($answer);
    }
}
unset($q);
api_json(['ok' => true, 'data' => ['surveys' => $surveys, 'survey_id' => $survey_id, 'survey' => $survey, 'questions' => $questions, 'total_respondents' => (int)$total_respondents, 'generated_on' => date('F j, Y \a\t g:i A')]]);
}

function api_staff_report(mysqli $conn): void {
    api_staff_user($conn);
$surveys = $conn->query("SELECT survey_id, title FROM surveys ORDER BY created_at DESC");
$survey_id = api_report_survey_id();
$survey = null;
$questions = [];
$total_respondents = 0;

if ($survey_id) {
    $stmt = $conn->prepare("SELECT s.*, st.full_name AS created_by_name FROM surveys s LEFT JOIN staff st ON st.staff_id = s.created_by WHERE s.survey_id = ?");
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
                    WHERE c.question_id = ? GROUP BY c.choice_id, c.choice_text
                ");
            } elseif ($q['question_type'] === 'yesno') {
                // Yes and No both belong in the report even at zero, so the
                // reader can see the split rather than guess at a missing row.
                $stmt = $conn->prepare("
                    SELECT o.choice_text, COUNT(sr.answer_id) AS votes
                    FROM (SELECT 'Yes' AS choice_text UNION ALL SELECT 'No') o
                    LEFT JOIN survey_results sr
                           ON sr.answer_text = o.choice_text AND sr.question_id = ?
                    GROUP BY o.choice_text ORDER BY o.choice_text DESC
                ");
            } elseif ($q['question_type'] === 'rating') {
                // Same for the 1-5 scale: an unused star still gets a row.
                $stmt = $conn->prepare("
                    SELECT CONCAT(o.n,' star(s)') AS choice_text, COUNT(sr.answer_id) AS votes
                    FROM (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3
                          UNION ALL SELECT 4 UNION ALL SELECT 5) o
                    LEFT JOIN survey_results sr
                           ON sr.rating_value = o.n AND sr.question_id = ?
                    GROUP BY o.n ORDER BY o.n
                ");
            } else {
                $stmt = $conn->prepare("SELECT answer_text FROM survey_results WHERE question_id = ? AND answer_text IS NOT NULL AND answer_text != ''");
            }
            $stmt->bind_param('i', $qid);
            $stmt->execute();
            $q['rows'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
            $questions[] = $q;
        }
    }
}


$surveys = $surveys->fetch_all(MYSQLI_ASSOC);
if ($survey) {
    $survey = array_intersect_key($survey, array_flip(['survey_id', 'title', 'description', 'start_date', 'end_date', 'status', 'created_by_name']));
    $survey['period_label'] = date('M d, Y', strtotime($survey['start_date'])) . ' — ' . date('M d, Y', strtotime($survey['end_date']));
}
foreach ($questions as &$q) {
    $q['answered_here'] = $q['question_type'] === 'short_answer' ? count($q['rows']) : (int)array_sum(array_column($q['rows'], 'votes'));
}
unset($q);
api_json(['ok' => true, 'data' => ['surveys' => $surveys, 'survey_id' => $survey_id, 'survey' => $survey, 'questions' => $questions, 'total_respondents' => (int)$total_respondents, 'generated_on' => date('F j, Y \a\t g:i A')]]);
}
