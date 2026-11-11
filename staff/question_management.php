<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Question Management';
$asset_path = '../';
$survey_id = (int)($_GET['survey_id'] ?? 0);
$error = '';
$message = '';
$form_had_error = false;
$edit_had_error = false;

$stmt = $conn->prepare("SELECT * FROM surveys WHERE survey_id = ?");
$stmt->bind_param('i', $survey_id);
$stmt->execute();
$survey = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$survey) {
    redirect('survey_management.php');
}

/**
 * Renumber a survey's questions 1..n in their current order. Called after a
 * delete or a move so the stored order never develops gaps, which would
 * eventually let two questions collide on the same number.
 */
function resequence_questions($conn, $survey_id) {
    $rows = $conn->prepare("SELECT question_id FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC, question_id ASC");
    $rows->bind_param('i', $survey_id);
    $rows->execute();
    $ids = array_column($rows->get_result()->fetch_all(MYSQLI_ASSOC), 'question_id');
    $rows->close();

    $set = $conn->prepare("UPDATE survey_questions SET question_order = ? WHERE question_id = ?");
    foreach ($ids as $position => $qid) {
        $order = $position + 1;
        $set->bind_param('ii', $order, $qid);
        $set->execute();
    }
    $set->close();
}

// Delete a question
if (isset($_GET['delete'])) {
    $qid = (int)$_GET['delete'];
    $stmt = $conn->prepare("DELETE FROM survey_questions WHERE question_id = ? AND survey_id = ?");
    $stmt->bind_param('ii', $qid, $survey_id);
    $stmt->execute();
    $stmt->close();
    resequence_questions($conn, $survey_id);
    redirect('question_management.php?survey_id=' . $survey_id . '&deleted=1');
}
if (isset($_GET['deleted'])) {
    $message = 'Question deleted.';
}

/**
 * Move a question up or down by swapping its order with its neighbour.
 * Residents answer in this order, so a survey built out of sequence can be
 * corrected without deleting and re-adding anything.
 */
if (isset($_GET['move'], $_GET['qid'])) {
    $direction = $_GET['move'] === 'up' ? 'up' : 'down';
    $qid = (int)$_GET['qid'];

    $current = $conn->prepare("SELECT question_id, question_order FROM survey_questions WHERE question_id = ? AND survey_id = ?");
    $current->bind_param('ii', $qid, $survey_id);
    $current->execute();
    $row = $current->get_result()->fetch_assoc();
    $current->close();

    if ($row) {
        $comparison = $direction === 'up' ? '<' : '>';
        $sort       = $direction === 'up' ? 'DESC' : 'ASC';
        $neighbour = $conn->prepare(
            "SELECT question_id, question_order FROM survey_questions
             WHERE survey_id = ? AND question_order $comparison ?
             ORDER BY question_order $sort LIMIT 1"
        );
        $neighbour->bind_param('ii', $survey_id, $row['question_order']);
        $neighbour->execute();
        $swap_with = $neighbour->get_result()->fetch_assoc();
        $neighbour->close();

        if ($swap_with) {
            $set = $conn->prepare("UPDATE survey_questions SET question_order = ? WHERE question_id = ?");
            $set->bind_param('ii', $swap_with['question_order'], $row['question_id']);
            $set->execute();
            $set->bind_param('ii', $row['question_order'], $swap_with['question_id']);
            $set->execute();
            $set->close();
        }
    }
    redirect('question_management.php?survey_id=' . $survey_id . '&moved=1');
}
if (isset($_GET['moved'])) {
    $message = 'Question order updated.';
}

// Add a question
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['update_question'])) {
    $text = trim($_POST['question_text'] ?? '');
    $type = $_POST['question_type'] ?? 'short_answer';
    $choices = $_POST['choices'] ?? [];

    // Blank boxes are ignored on save, so count only the filled ones before
    // deciding whether a multiple-choice question is actually usable.
    $filled_choices = array_values(array_filter(array_map('trim', $choices), function ($c) { return $c !== ''; }));

    if ($text === '') {
        $error = 'Question text is required.';
        $form_had_error = true;
    } elseif (!valid_written_text($text, 5)) {
        $error = 'Write the question out in words: at least five characters, and not one repeated character.';
        $form_had_error = true;
    } elseif ($type === 'multiple_choice' && count($filled_choices) < 2) {
        $error = 'A multiple-choice question needs at least two choices. Blank boxes are ignored.';
        $form_had_error = true;
    } else {
        $order_result = $conn->query("SELECT COALESCE(MAX(question_order),0)+1 AS next_order FROM survey_questions WHERE survey_id = $survey_id");
        $next_order = $order_result->fetch_assoc()['next_order'];

        $stmt = $conn->prepare("INSERT INTO survey_questions (survey_id, question_text, question_type, question_order) VALUES (?, ?, ?, ?)");
        $stmt->bind_param('issi', $survey_id, $text, $type, $next_order);
        $stmt->execute();
        $question_id = $conn->insert_id;
        $stmt->close();

        if ($type === 'multiple_choice') {
            $c_stmt = $conn->prepare("INSERT INTO survey_choices (question_id, choice_text) VALUES (?, ?)");
            foreach ($filled_choices as $choice_text) {
                $c_stmt->bind_param('is', $question_id, $choice_text);
                $c_stmt->execute();
            }
            $c_stmt->close();
        }
        redirect('question_management.php?survey_id=' . $survey_id . '&added=1');
    }
}
if (isset($_GET['added'])) {
    $message = 'Question added.';
}

/**
 * Update an existing question.
 *
 * A choice that already carries answers keeps its choice_id, so fixing a typo
 * in a choice does not throw away the responses recorded against it. Only a
 * box the staff member deliberately clears is deleted.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_question'])) {
    $qid  = (int)($_POST['question_id'] ?? 0);
    $text = trim($_POST['question_text'] ?? '');
    $type = $_POST['question_type'] ?? 'short_answer';
    $existing_choices = $_POST['existing_choices'] ?? [];
    $new_choices = $_POST['new_choices'] ?? [];

    $owner = $conn->prepare("SELECT question_id FROM survey_questions WHERE question_id = ? AND survey_id = ?");
    $owner->bind_param('ii', $qid, $survey_id);
    $owner->execute();
    $owns_question = $owner->get_result()->fetch_assoc() !== null;
    $owner->close();

    $kept  = array_filter(array_map('trim', $existing_choices), function ($c) { return $c !== ''; });
    $added = array_values(array_filter(array_map('trim', $new_choices), function ($c) { return $c !== ''; }));

    if (!$owns_question) {
        $error = 'That question does not belong to this survey.';
    } elseif ($text === '') {
        $error = 'Question text is required.';
        $edit_had_error = true;
    } elseif (!valid_written_text($text, 5)) {
        $error = 'Write the question out in words: at least five characters, and not one repeated character.';
        $edit_had_error = true;
    } elseif ($type === 'multiple_choice' && (count($kept) + count($added)) < 2) {
        $error = 'A multiple-choice question needs at least two choices. Blank boxes are ignored.';
        $edit_had_error = true;
    } else {
        $stmt = $conn->prepare("UPDATE survey_questions SET question_text = ?, question_type = ? WHERE question_id = ? AND survey_id = ?");
        $stmt->bind_param('ssii', $text, $type, $qid, $survey_id);
        $stmt->execute();
        $stmt->close();

        if ($type === 'multiple_choice') {
            $update = $conn->prepare("UPDATE survey_choices SET choice_text = ? WHERE choice_id = ? AND question_id = ?");
            $remove = $conn->prepare("DELETE FROM survey_choices WHERE choice_id = ? AND question_id = ?");
            foreach ($existing_choices as $choice_id => $choice_text) {
                $choice_id = (int)$choice_id;
                $choice_text = trim($choice_text);
                if ($choice_text === '') {
                    $remove->bind_param('ii', $choice_id, $qid);
                    $remove->execute();
                } else {
                    $update->bind_param('sii', $choice_text, $choice_id, $qid);
                    $update->execute();
                }
            }
            $update->close();
            $remove->close();

            $insert = $conn->prepare("INSERT INTO survey_choices (question_id, choice_text) VALUES (?, ?)");
            foreach ($added as $choice_text) {
                $insert->bind_param('is', $qid, $choice_text);
                $insert->execute();
            }
            $insert->close();
        } else {
            // Switching away from multiple choice would otherwise leave orphans.
            $clear = $conn->prepare("DELETE FROM survey_choices WHERE question_id = ?");
            $clear->bind_param('i', $qid);
            $clear->execute();
            $clear->close();
        }
        redirect('question_management.php?survey_id=' . $survey_id . '&updated=1');
    }
}
if (isset($_GET['updated'])) {
    $message = 'Question updated.';
}

$questions = [];
$q_result = $conn->query("SELECT * FROM survey_questions WHERE survey_id = $survey_id ORDER BY question_order ASC, question_id ASC");
while ($q = $q_result->fetch_assoc()) {
    $q['choices'] = [];
    if ($q['question_type'] === 'multiple_choice') {
        $c_stmt = $conn->prepare("SELECT * FROM survey_choices WHERE question_id = ? ORDER BY choice_id ASC");
        $c_stmt->bind_param('i', $q['question_id']);
        $c_stmt->execute();
        $q['choices'] = $c_stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $c_stmt->close();
    }
    $questions[] = $q;
}

$type_labels = [
    'multiple_choice' => 'Multiple Choice',
    'yesno' => 'Yes/No',
    'rating' => 'Rating Scale',
    'short_answer' => 'Short Answer',
];
$last_index = count($questions) - 1;

require_once '../includes/header_staff.php';
?>
<?php // Top-left return link, matching the other detail pages. ?>
<a class="back-link" href="survey_management.php">&larr; Back to Survey List</a>

<div class="card">
    <div class="card-head">
        <div>
            <h2 class="card-head-title" style="margin:0;">Questions for: <?= h($survey['title']) ?></h2>
            <p class="muted-note" style="margin:4px 0 0;">Residents answer these in the order shown. Use the arrows to rearrange.</p>
        </div>
        <button type="button" class="btn" data-modal-open="add-question-modal">+ Add Question</button>
    </div>

    <?php if ($message): ?><div class="alert alert-success" style="margin-top:16px;"><?= h($message) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="alert alert-error" style="margin-top:16px;"><?= h($error) ?></div><?php endif; ?>

    <?php if (empty($questions)): ?>
        <p style="color:#6b7c76;margin-top:16px;">No questions yet. Click "+ Add Question" to create one.</p>
    <?php else: ?>
        <table class="table-spaced" style="margin-top:16px;">
            <tr><th>#</th><th>Question</th><th>Type</th><th>Choices</th><th>Order</th><th>Actions</th></tr>
            <?php foreach ($questions as $i => $q): ?>
            <tr>
                <td><?= $i + 1 ?></td>
                <td><?= h($q['question_text']) ?></td>
                <td><?= h($type_labels[$q['question_type']] ?? $q['question_type']) ?></td>
                <td><?= $q['choices'] ? h(implode(', ', array_column($q['choices'], 'choice_text'))) : '&mdash;' ?></td>
                <td class="nowrap">
                    <?php if ($i > 0): ?>
                        <a class="btn-action" title="Move up" aria-label="Move up"
                           href="question_management.php?survey_id=<?= $survey_id ?>&move=up&qid=<?= (int)$q['question_id'] ?>">&uarr;</a>
                    <?php else: ?>
                        <span class="btn-action btn-action-muted" aria-hidden="true">&uarr;</span>
                    <?php endif; ?>
                    <?php if ($i < $last_index): ?>
                        <a class="btn-action" title="Move down" aria-label="Move down"
                           href="question_management.php?survey_id=<?= $survey_id ?>&move=down&qid=<?= (int)$q['question_id'] ?>">&darr;</a>
                    <?php else: ?>
                        <span class="btn-action btn-action-muted" aria-hidden="true">&darr;</span>
                    <?php endif; ?>
                </td>
                <td class="nowrap">
                    <button type="button" class="btn-action btn-action-primary edit-question-btn"
                            title="Edit question" aria-label="Edit question"
                            data-question='<?= h(json_encode([
                                'question_id'   => (int)$q['question_id'],
                                'question_text' => $q['question_text'],
                                'question_type' => $q['question_type'],
                                'choices'       => array_map(function ($c) {
                                    return ['choice_id' => (int)$c['choice_id'], 'choice_text' => $c['choice_text']];
                                }, $q['choices']),
                            ], JSON_HEX_APOS | JSON_HEX_QUOT)) ?>'><?= nav_icon('edit') ?></button>
                    <a class="btn-action btn-action-danger" title="Delete question" aria-label="Delete question"
                       href="question_management.php?survey_id=<?= $survey_id ?>&delete=<?= (int)$q['question_id'] ?>"
                       data-confirm="Delete this question and all related answers?"><?= nav_icon('trash') ?></a>
                </td>
            </tr>
            <?php endforeach; ?>
        </table>
    <?php endif; ?>
</div>

<!-- Add Question modal -->
<div class="modal-overlay<?= $form_had_error ? ' active' : '' ?>" id="add-question-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Add Question</h2>
        <?php if ($error && $form_had_error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
        <form method="POST" id="add-question-form" data-dirty-warn>
            <label for="question_text">Question Text <span class="req">*</span></label>
            <input type="text" id="question_text" name="question_text" required maxlength="255"
                   value="<?= h($_POST['question_text'] ?? '') ?>"
                placeholder="e.g. How would you rate our services?">

            <div class="question-row">
                <label for="question_type">Question Type</label>
                <select id="question_type" name="question_type" class="question-type-select">
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="yesno">Yes/No</option>
                    <option value="rating">Rating Scale (1-5)</option>
                    <option value="short_answer">Short Answer</option>
                </select>

                <div class="choices-box" style="display:none;">
                    <label>Choices <span class="req">*</span></label>
                    <p class="field-hint">At least two. Blank boxes are ignored when you save.</p>
                    <div class="choices-inputs" data-choice-name="choices">
                        <div class="choice-row">
                            <input type="text" name="choices[]" maxlength="150" placeholder="Choice 1">
                            <button type="button" class="btn-action btn-action-danger remove-choice-btn" title="Remove this choice" aria-label="Remove this choice">&times;</button>
                        </div>
                        <div class="choice-row">
                            <input type="text" name="choices[]" maxlength="150" placeholder="Choice 2">
                            <button type="button" class="btn-action btn-action-danger remove-choice-btn" title="Remove this choice" aria-label="Remove this choice">&times;</button>
                        </div>
                    </div>
                    <button type="button" class="add-choice-btn btn-secondary btn-small">+ Add Choice</button>
                </div>
            </div>

            <div class="modal-actions">
                <button type="submit" class="btn">Add Question</button>
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            </div>
        </form>
    </div>
</div>

<!-- Edit Question modal, filled in by the row buttons above -->
<div class="modal-overlay<?= $edit_had_error ? ' active' : '' ?>" id="edit-question-modal">
    <div class="modal-box">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <h2>Edit Question</h2>
        <?php if ($error && $edit_had_error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>
        <form method="POST" id="edit-question-form" data-dirty-warn>
            <input type="hidden" name="update_question" value="1">
            <input type="hidden" name="question_id" id="edit_question_id" value="<?= (int)($_POST['question_id'] ?? 0) ?>">

            <label for="edit_question_text">Question Text <span class="req">*</span></label>
            <input type="text" id="edit_question_text" name="question_text" required maxlength="255"
                   value="<?= h($_POST['question_text'] ?? '') ?>"
                placeholder="e.g. How would you rate our services?">

            <div class="question-row">
                <label for="edit_question_type">Question Type</label>
                <select id="edit_question_type" name="question_type" class="question-type-select">
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="yesno">Yes/No</option>
                    <option value="rating">Rating Scale (1-5)</option>
                    <option value="short_answer">Short Answer</option>
                </select>

                <div class="choices-box" style="display:none;">
                    <label>Choices <span class="req">*</span></label>
                    <p class="field-hint">Clearing a box removes that choice, along with the answers recorded against it.</p>
                    <div class="choices-inputs" id="edit-choices-inputs" data-choice-name="new_choices"></div>
                    <button type="button" class="add-choice-btn btn-secondary btn-small">+ Add Choice</button>
                </div>
            </div>

            <div class="modal-actions">
                <button type="submit" class="btn">Save Changes</button>
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            </div>
        </form>
    </div>
</div>

<!-- Success confirmation modal -->
<div class="modal-overlay<?= ($message && !$form_had_error && !$edit_had_error) ? ' active' : '' ?>" id="question-success-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Success</h2>
        <p style="color:var(--muted);"><?= h($message) ?></p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>

<script>
(function () {
    // Fill the edit modal from whichever row was clicked.
    document.querySelectorAll('.edit-question-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var q = JSON.parse(btn.getAttribute('data-question'));
            document.getElementById('edit_question_id').value = q.question_id;
            document.getElementById('edit_question_text').value = q.question_text;

            var typeSelect = document.getElementById('edit_question_type');
            typeSelect.value = q.question_type;

            // Existing choices keep their id so recorded answers stay attached.
            var box = document.getElementById('edit-choices-inputs');
            box.innerHTML = '';
            q.choices.forEach(function (choice, i) {
                var row = document.createElement('div');
                row.className = 'choice-row';

                var input = document.createElement('input');
                input.type = 'text';
                input.name = 'existing_choices[' + choice.choice_id + ']';
                input.maxLength = 150;
                input.value = choice.choice_text;
                input.placeholder = 'Choice ' + (i + 1);

                var remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'btn-action btn-action-danger remove-choice-btn';
                remove.title = 'Remove this choice';
                remove.setAttribute('aria-label', 'Remove this choice');
                remove.innerHTML = '&times;';

                row.appendChild(input);
                row.appendChild(remove);
                box.appendChild(row);
            });

            typeSelect.dispatchEvent(new Event('change'));
            document.getElementById('edit-question-modal').classList.add('active');
        });
    });
})();
</script>

<?php require_once '../includes/footer.php'; ?>
