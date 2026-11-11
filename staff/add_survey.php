<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Create Survey';
$asset_path = '../';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $start_date = $_POST['start_date'] ?? '';
    $end_date = $_POST['end_date'] ?? '';
    $questions = $_POST['questions'] ?? [];

    if ($title === '' || $start_date === '' || $end_date === '') {
        $error = 'Title, start date, and end date are required.';
    } elseif (!valid_written_text($title, 8)) {
        $error = 'Give the survey a real title - at least eight characters that describe what it is about.';
    } elseif ($description !== '' && !valid_written_text($description, 10)) {
        $error = 'Either write a proper description of at least ten characters, or leave it blank.';
    } elseif ($start_date > $end_date) {
        $error = 'Start date cannot be after end date.';
    } elseif (count(array_filter($questions, function ($q) {
        // Blank question boxes are dropped further down, so counting the
        // array itself would let a survey through with no questions at all.
        return trim($q['text'] ?? '') !== '';
    })) === 0) {
        $error = 'Please add at least one question, and give it a question to ask.';
    } else {
        $conn->begin_transaction();
        try {
            $staff_id = $_SESSION['staff_id'];
            $stmt = $conn->prepare("INSERT INTO surveys (title, description, start_date, end_date, status, created_by) VALUES (?, ?, ?, ?, 'active', ?)");
            $stmt->bind_param('ssssi', $title, $description, $start_date, $end_date, $staff_id);
            $stmt->execute();
            $survey_id = $conn->insert_id;
            $stmt->close();

            $order = 0;
            foreach ($questions as $q) {
                $text = trim($q['text'] ?? '');
                $type = $q['type'] ?? 'short_answer';
                if ($text === '') continue;
                $order++;

                $q_stmt = $conn->prepare("INSERT INTO survey_questions (survey_id, question_text, question_type, question_order) VALUES (?, ?, ?, ?)");
                $q_stmt->bind_param('issi', $survey_id, $text, $type, $order);
                $q_stmt->execute();
                $question_id = $conn->insert_id;
                $q_stmt->close();

                if ($type === 'multiple_choice' && !empty($q['choices'])) {
                    $c_stmt = $conn->prepare("INSERT INTO survey_choices (question_id, choice_text) VALUES (?, ?)");
                    foreach ($q['choices'] as $choice_text) {
                        $choice_text = trim($choice_text);
                        if ($choice_text === '') continue;
                        $c_stmt->bind_param('is', $question_id, $choice_text);
                        $c_stmt->execute();
                    }
                    $c_stmt->close();
                }
            }
            $conn->commit();
            redirect('survey_management.php');
        } catch (Exception $e) {
            $conn->rollback();
            $error = 'An error occurred while creating the survey.';
        }
    }
}

require_once '../includes/header_staff.php';
?>
<div class="card">
    <h2>Create New Survey</h2>
    <?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

    <p class="field-hint">Fields marked <span class="req">*</span> are required.</p>

    <form method="POST" id="survey-builder-form" data-dirty-warn>
        <label for="title">Survey Title <span class="req">*</span></label>
        <input type="text" id="title" name="title" required minlength="8" maxlength="150"
               placeholder="e.g. Barangay Health Services Satisfaction Survey 2026"
               value="<?= h($_POST['title'] ?? '') ?>">
        <p class="field-hint">8 to 150 characters. Name the topic so residents know what they are answering.</p>

        <label for="description">Description</label>
        <textarea id="description" name="description" maxlength="500"
                  placeholder="One or two sentences on why the barangay is collecting these answers."><?= h($_POST['description'] ?? '') ?></textarea>
        <p class="field-hint">Optional, up to 500 characters.</p>

        <div class="grid-2">
            <div>
                <label for="start_date">Opening Date <span class="req">*</span></label>
                <input type="date" id="start_date" name="start_date" required value="<?= h($_POST['start_date'] ?? date('Y-m-d')) ?>">
            </div>
            <div>
                <label for="end_date">Closing Date <span class="req">*</span></label>
                <input type="date" id="end_date" name="end_date" required value="<?= h($_POST['end_date'] ?? date('Y-m-d', strtotime('+7 days'))) ?>">
            </div>
        </div>

        <h3>Questions</h3>
        <div id="questions-container"></div>
        <button type="button" id="add-question-btn" class="btn-secondary" style="margin-bottom:20px;">+ Add Question</button>

        <div class="form-actions">
            <button type="submit" class="btn">Save Survey</button>
            <button type="button" class="btn btn-secondary" id="preview-survey-btn">Preview Survey</button>
            <a class="btn btn-secondary" href="survey_management.php">Cancel</a>
        </div>
    </form>
</div>

<template id="question-template">
    <div class="card question-row" style="background:#fafcfb;">
        <div class="question-row-head">
            <h4 class="question-row-number">Question</h4>
            <button type="button" class="remove-question-btn btn-action btn-action-danger" title="Remove this question" aria-label="Remove this question">&times;</button>
        </div>

        <label>Question Text <span class="req">*</span></label>
        <input type="text" name="questions[__IDX__][text]" required maxlength="255"
               placeholder="e.g. How long did you wait before being attended to?">

        <label>Question Type</label>
        <select name="questions[__IDX__][type]" class="question-type-select">
            <option value="multiple_choice">Multiple Choice</option>
            <option value="yesno">Yes/No</option>
            <option value="rating">Rating Scale (1-5)</option>
            <option value="short_answer">Short Answer</option>
        </select>

        <div class="choices-box" style="display:none;">
            <label>Choices <span class="req">*</span></label>
            <p class="field-hint">At least two. Blank boxes are ignored when you save.</p>
            <div class="choices-inputs" data-choice-name="questions[__IDX__][choices]">
                <div class="choice-row">
                    <input type="text" name="questions[__IDX__][choices][]" maxlength="150" placeholder="Choice 1">
                    <button type="button" class="btn-action btn-action-danger remove-choice-btn" title="Remove this choice" aria-label="Remove this choice">&times;</button>
                </div>
                <div class="choice-row">
                    <input type="text" name="questions[__IDX__][choices][]" maxlength="150" placeholder="Choice 2">
                    <button type="button" class="btn-action btn-action-danger remove-choice-btn" title="Remove this choice" aria-label="Remove this choice">&times;</button>
                </div>
            </div>
            <button type="button" class="add-choice-btn btn-secondary btn-small">+ Add Choice</button>
        </div>
    </div>
</template>

<script>
(function () {
    var container = document.getElementById('questions-container');
    var template = document.getElementById('question-template');
    var idx = 0;

    // Choice add/remove and the multiple-choice toggle are handled globally in
    // script.js. Wiring them again here is what produced two choices per click.
    function renumber() {
        container.querySelectorAll('.question-row-number').forEach(function (heading, i) {
            heading.textContent = 'Question ' + (i + 1);
        });
    }

    function addQuestion() {
        var html = template.innerHTML.replaceAll('__IDX__', idx);
        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        var node = wrapper.firstElementChild;
        container.appendChild(node);
        idx++;

        var select = node.querySelector('.question-type-select');
        select.dispatchEvent(new Event('change', { bubbles: true }));

        node.querySelector('.remove-question-btn').addEventListener('click', function () {
            node.remove();
            renumber();
        });

        renumber();
    }

    document.getElementById('add-question-btn').addEventListener('click', addQuestion);
    addQuestion(); // start with one question row

    // ---------- Preview ----------
    // Renders the form's current contents the way a resident would see them,
    // so mistakes are caught before the survey is published.
    var typeNames = {
        multiple_choice: 'Multiple Choice',
        yesno: 'Yes/No',
        rating: 'Rating Scale (1-5)',
        short_answer: 'Short Answer'
    };

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function buildPreview() {
        var body = document.getElementById('survey-preview-body');
        var title = document.getElementById('title').value.trim();
        var description = document.getElementById('description').value.trim();
        var html = '<h2 style="margin-top:0;">' + (escapeHtml(title) || '<em>Untitled survey</em>') + '</h2>';

        if (description) {
            html += '<p style="color:var(--muted);">' + escapeHtml(description) + '</p>';
        }
        html += '<p class="muted-note">Open ' + escapeHtml(document.getElementById('start_date').value) +
                ' to ' + escapeHtml(document.getElementById('end_date').value) + '.</p><hr>';

        var rows = container.querySelectorAll('.question-row');
        if (!rows.length) {
            html += '<p class="empty-state">No questions added yet.</p>';
        }

        rows.forEach(function (row, i) {
            var text = row.querySelector('input[type="text"]').value.trim();
            var type = row.querySelector('.question-type-select').value;
            html += '<div style="margin-bottom:18px;">';
            html += '<p style="font-weight:600;margin-bottom:6px;">' + (i + 1) + '. ' +
                    (escapeHtml(text) || '<em>Empty question</em>') +
                    ' <span class="muted-note">(' + typeNames[type] + ')</span></p>';

            if (type === 'multiple_choice') {
                html += '<ul style="margin:0 0 0 18px;">';
                var filled = 0;
                row.querySelectorAll('.choices-inputs input').forEach(function (choice) {
                    if (choice.value.trim() !== '') {
                        filled++;
                        html += '<li>' + escapeHtml(choice.value.trim()) + '</li>';
                    }
                });
                if (!filled) { html += '<li><em>No choices entered - this question cannot be saved yet.</em></li>'; }
                html += '</ul>';
            } else if (type === 'yesno') {
                html += '<p class="muted-note" style="margin:0 0 0 18px;">Yes / No</p>';
            } else if (type === 'rating') {
                html += '<p class="muted-note" style="margin:0 0 0 18px;">1 to 5 stars</p>';
            } else {
                html += '<p class="muted-note" style="margin:0 0 0 18px;">Free-text answer box</p>';
            }
            html += '</div>';
        });

        body.innerHTML = html;
        document.getElementById('survey-preview-modal').classList.add('active');
    }

    document.getElementById('preview-survey-btn').addEventListener('click', buildPreview);
})();
</script>

<!-- Preview modal -->
<div class="modal-overlay" id="survey-preview-modal">
    <div class="modal-box modal-wide">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <p class="muted-note">Preview only - nothing is saved until you click Save Survey.</p>
        <div id="survey-preview-body"></div>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Back to Editing</button>
        </div>
    </div>
</div>

<?php require_once '../includes/footer.php'; ?>
