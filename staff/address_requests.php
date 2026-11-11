<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Address Requests';
$asset_path = '../';
$error = '';
$message = '';

$is_admin = staff_is_admin();
$me = (int)$_SESSION['staff_id'];
$my_name = $_SESSION['staff_name'] ?? '';

/* ------------------------------------------------------------
   Staff address change requests  (Admin only)

   Approving copies the requested parts onto the staff row and rebuilds the
   single-line address from them. Nothing on that row moves before this.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Family & household change requests raised by residents.

   Approving applies the whole proposed set at once, inside a transaction:
   the columns on the resident row, and the children and character reference
   rows rebuilt from the payload. A half-applied family record would be worse
   than none, so either all of it lands or none does.
   ------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['family_request_id'])) {
    $family_request_id = (int)$_POST['family_request_id'];
    $decision = ($_POST['family_action'] ?? '') === 'approve' ? 'approved' : 'rejected';
    $comment = trim($_POST['family_comment'] ?? '');

    $stmt = $conn->prepare("SELECT * FROM resident_family_requests WHERE request_id = ? AND status = 'pending'");
    $stmt->bind_param('i', $family_request_id);
    $stmt->execute();
    $family_request = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$family_request) {
        $error = 'That request has already been decided.';
    } else {
        $payload = json_decode($family_request['payload'], true);
        if (!is_array($payload)) {
            $error = 'That request could not be read and was left pending.';
        } else {
            $conn->begin_transaction();
            try {
                if ($decision === 'approved') {
                    $target_id = (int)$family_request['resident_id'];

                    $columns = ['occupation', 'hotline_number'];
                    foreach (['spouse', 'father', 'mother'] as $who) {
                        foreach (person_field_keys() as $field) {
                            $columns[] = $who . '_' . $field;
                        }
                    }

                    $set = [];
                    $values = [];
                    foreach ($columns as $column) {
                        $set[] = "`$column` = ?";
                        $values[] = (string)($payload[$column] ?? '');
                    }
                    $set[] = '`is_married` = ?';
                    $set[] = '`has_children` = ?';
                    $married_flag = !empty($payload['is_married']) ? 1 : 0;
                    $children_flag = !empty($payload['has_children']) ? 1 : 0;

                    $sql = 'UPDATE residents SET ' . implode(', ', $set) . ' WHERE resident_id = ?';
                    $update = $conn->prepare($sql);
                    $types = str_repeat('s', count($values)) . 'iii';
                    $params = $values;
                    $params[] = $married_flag;
                    $params[] = $children_flag;
                    $params[] = $target_id;
                    $update->bind_param($types, ...$params);
                    $update->execute();
                    $update->close();

                    replace_person_rows($conn, 'resident_children', $target_id, $payload['children'] ?? []);
                    replace_person_rows($conn, 'resident_character_references', $target_id, $payload['references'] ?? []);
                }

                $reviewer_id = (int)($_SESSION['staff_id'] ?? 0);
                $reviewer_name = (string)($_SESSION['staff_name'] ?? 'Barangay Health Officer');
                $close = $conn->prepare("
                    UPDATE resident_family_requests
                       SET status = ?, reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?, review_comment = ?
                     WHERE request_id = ?
                ");
                $close->bind_param('sissi', $decision, $reviewer_id, $reviewer_name, $comment, $family_request_id);
                $close->execute();
                $close->close();

                $conn->commit();
                $_SESSION['flash_success'] = $decision === 'approved'
                    ? 'Family details updated from the resident\'s request.'
                    : 'Family details request rejected. Nothing on the record changed.';
                redirect('address_requests.php');
            } catch (Exception $e) {
                $conn->rollback();
                error_log('Family request review failed: ' . $e->getMessage());
                $error = 'That request could not be applied. Nothing was changed.';
            }
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['staff_request_id'])) {
    if (!$is_admin) {
        $error = 'Only an administrator can review staff address changes.';
    } else {
        $request_id = (int)$_POST['staff_request_id'];
        $action = ($_POST['action'] ?? '') === 'approve' ? 'approved' : 'rejected';
        $review_comment = trim($_POST['review_comment'] ?? '');

        $stmt = $conn->prepare("SELECT * FROM staff_update_requests WHERE request_id = ? AND status = 'pending' LIMIT 1");
        $stmt->bind_param('i', $request_id);
        $stmt->execute();
        $staff_request = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$staff_request) {
            $error = 'That staff request was not found, or it has already been reviewed.';
        } else {
            $conn->begin_transaction();

            $close = $conn->prepare("UPDATE staff_update_requests
                                        SET status = ?, reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?, review_comment = ?
                                      WHERE request_id = ?");
            $close->bind_param('sissi', $action, $me, $my_name, $review_comment, $request_id);
            $close->execute();
            $close->close();

            if ($action === 'approved') {
                $approved_address = build_address_line(
                    $staff_request['household_number'], $staff_request['purok'],
                    $staff_request['street_highway'], $staff_request['barangay'],
                    $staff_request['municipality'], $staff_request['postal_code'],
                    $staff_request['province']
                );

                $apply = $conn->prepare(
                    "UPDATE staff
                        SET household_number = ?, purok = ?, street_highway = ?,
                            barangay = ?, municipality = ?, postal_code = ?, province = ?, address = ?
                      WHERE staff_id = ?"
                );
                $apply->bind_param(
                    'ssssssssi',
                    $staff_request['household_number'], $staff_request['purok'],
                    $staff_request['street_highway'], $staff_request['barangay'],
                    $staff_request['municipality'], $staff_request['postal_code'],
                    $staff_request['province'], $approved_address,
                    $staff_request['staff_id']
                );
                $apply->execute();
                $apply->close();
            }

            $conn->commit();
            $message = 'Staff address request has been ' . $action . '.';
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && isset($_POST['request_id'])) {
    $request_id = (int)$_POST['request_id'];
    $action = $_POST['action'] === 'approve' ? 'approved' : 'rejected';
    $review_comment = trim($_POST['review_comment'] ?? '');
    $reviewed_by = $_SESSION['staff_id'] ?? null;

    $stmt = $conn->prepare("SELECT * FROM resident_update_requests WHERE request_id = ? AND status = 'pending' LIMIT 1");
    $stmt->bind_param('i', $request_id);
    $stmt->execute();
    $request = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$request) {
        $error = 'Request not found or already processed.';
    } else {
        $conn->begin_transaction();
        $update_request = $conn->prepare("UPDATE resident_update_requests SET status = ?, reviewed_at = NOW(), reviewed_by = ?, review_comment = ? WHERE request_id = ?");
        $update_request->bind_param('sisi', $action, $reviewed_by, $review_comment, $request_id);
        $update_request->execute();
        $update_request->close();

        if ($action === 'approved') {
            // A birthdate-only request carries no address parts. Writing them
            // anyway would blank the resident's stored address.
            $carries_address = trim((string)($request['household_number'] ?? '')) !== '';

            // Write the seven parts onto the resident and rebuild the
            // display line from them, so the parts stay the source of truth.
            $approved_address = build_address_line(
                $request['household_number'], $request['purok'], $request['street_highway'],
                $request['barangay'], $request['municipality'], $request['postal_code'], $request['province']
            );
            if ($approved_address === '') {
                $approved_address = (string)($request['address'] ?? '');
            }

            if ($carries_address) {
                $update_resident = $conn->prepare(
                    "UPDATE residents
                        SET household_number = ?, purok = ?, street_highway = ?, barangay = ?,
                            municipality = ?, postal_code = ?, province = ?, address = ?
                      WHERE resident_id = ?"
                );
                $update_resident->bind_param(
                    'ssssssssi',
                    $request['household_number'], $request['purok'], $request['street_highway'],
                    $request['barangay'], $request['municipality'], $request['postal_code'],
                    $request['province'], $approved_address, $request['resident_id']
                );
                $update_resident->execute();
                $update_resident->close();
            }

            // Same treatment for the temporary address, when the request
            // carried one. A resident who only fixed their permanent address
            // must not have their temporary one wiped.
            $carries_temp = trim((string)($request['temp_household_number'] ?? '')) !== '';
            if ($carries_temp) {
                $approved_temp_address = build_address_line(
                    $request['temp_household_number'], $request['temp_purok'], $request['temp_street_highway'],
                    $request['temp_barangay'], $request['temp_municipality'], $request['temp_postal_code'],
                    $request['temp_province']
                );
                if ($approved_temp_address === '') {
                    $approved_temp_address = (string)($request['temporary_address'] ?? '');
                }
                $update_temp = $conn->prepare(
                    "UPDATE residents
                        SET temp_household_number = ?, temp_purok = ?, temp_street_highway = ?, temp_barangay = ?,
                            temp_municipality = ?, temp_postal_code = ?, temp_province = ?, temporary_address = ?
                      WHERE resident_id = ?"
                );
                $update_temp->bind_param(
                    'ssssssssi',
                    $request['temp_household_number'], $request['temp_purok'], $request['temp_street_highway'],
                    $request['temp_barangay'], $request['temp_municipality'], $request['temp_postal_code'],
                    $request['temp_province'], $approved_temp_address, $request['resident_id']
                );
                $update_temp->execute();
                $update_temp->close();
            }

            // Name parts are only touched when the request actually carried
            // them. A birthdate-only request leaves the name alone.
            $approved_first_name = trim((string)($request['first_name'] ?? ''));
            $approved_last_name = trim((string)($request['last_name'] ?? ''));
            if ($approved_first_name !== '' || $approved_last_name !== '') {
                $update_name = $conn->prepare("UPDATE residents
                        SET courtesy_title = ?, first_name = ?, middle_name = ?, last_name = ?, name_extension = ?
                      WHERE resident_id = ?");
                $update_name->bind_param('sssssi',
                    $request['courtesy_title'], $approved_first_name, $request['middle_name'],
                    $approved_last_name, $request['name_extension'], $request['resident_id']);
                $update_name->execute();
                $update_name->close();
            }

            // A birthdate correction arrives as its own request.
            if (!empty($request['birthdate'])) {
                $update_birthdate = $conn->prepare("UPDATE residents SET birthdate = ? WHERE resident_id = ?");
                $update_birthdate->bind_param('si', $request['birthdate'], $request['resident_id']);
                $update_birthdate->execute();
                $update_birthdate->close();
            }
        }

        $conn->commit();
        $message = 'Request has been ' . ($action === 'approved' ? 'approved' : 'rejected') . '.';
    }
}

$requests = [];
$result = $conn->query("SELECT r.*, r.first_name AS request_first_name, r.last_name AS request_last_name,
       s.first_name AS resident_first_name, s.last_name AS resident_last_name
    FROM resident_update_requests r
    JOIN residents s ON s.resident_id = r.resident_id
    ORDER BY r.status = 'pending' DESC, r.submitted_at DESC");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }
}

// Staff see only their own request history here; an administrator sees all.
$staff_requests = [];
if ($is_admin) {
    $staff_result = $conn->query("SELECT * FROM staff_update_requests ORDER BY status = 'pending' DESC, submitted_at DESC");
} else {
    $staff_result_stmt = $conn->prepare("SELECT * FROM staff_update_requests WHERE staff_id = ? ORDER BY submitted_at DESC");
    $staff_result_stmt->bind_param('i', $me);
    $staff_result_stmt->execute();
    $staff_result = $staff_result_stmt->get_result();
}
if ($staff_result) {
    while ($row = $staff_result->fetch_assoc()) {
        $staff_requests[] = $row;
    }
}

$staff_pending = 0;
foreach ($staff_requests as $r) {
    if ($r['status'] === 'pending') { $staff_pending++; }
}

/* Family requests waiting on a decision, newest first. */
$family_requests = [];
$res = $conn->query("
    SELECT fr.*, r.resident_number, r.first_name, r.middle_name, r.last_name
    FROM resident_family_requests fr
    JOIN residents r ON r.resident_id = fr.resident_id
    ORDER BY fr.status = 'pending' DESC, fr.requested_at DESC
");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $row['decoded'] = json_decode($row['payload'], true) ?: [];
        $family_requests[] = $row;
    }
}

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Address Requests</h1>
        <p><?= $is_admin
            ? 'Review name and address changes submitted by residents and staff.'
            : 'Review address changes submitted by residents.' ?></p>
    </div>
</div>

<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Resident Requests (<?= count($requests) ?>)</h3>
    </div>

    <table>
        <tr>
            <th>Resident</th>
            <th>Current Address</th>
            <th>Requested Address</th>
            <th>Status</th>
            <th>Submitted</th>
            <th></th>
        </tr>
        <?php if (!$requests): ?>
        <tr><td colspan="6" class="empty-state">No address requests submitted yet.</td></tr>
        <?php endif; ?>
        <?php foreach ($requests as $req): ?>
        <tr>
            <td><?= h(trim(($req['request_first_name'] ?? '') . ' ' . ($req['request_last_name'] ?? '')) ?: ($req['resident_first_name'] . ' ' . $req['resident_last_name'])) ?></td>
            <td><?= $req['previous_address'] ? h($req['previous_address']) : 'N/A' ?></td>
            <td>
                <?php
                $requested_address = build_address_line(
                    $req['household_number'] ?? '', $req['purok'] ?? '', $req['street_highway'] ?? '',
                    $req['barangay'] ?? ($req['barangay_subdivision'] ?? ''), $req['municipality'] ?? '',
                    $req['postal_code'] ?? '', $req['province'] ?? ''
                );
                if ($requested_address === '') {
                    $requested_address = (string)($req['address'] ?? '');
                }
                ?>
                <?= $requested_address !== '' ? h($requested_address) : '<span class="muted-note">&mdash;</span>' ?>
                <?php if (!empty($req['birthdate'])): ?>
                    <div class="muted-note">Birthdate correction: <?= h($req['birthdate']) ?></div>
                <?php endif; ?>
            </td>
            <td><span class="badge badge-<?= h($req['status']) ?>"><?= h(ucfirst($req['status'])) ?></span></td>
            <td><?= h($req['submitted_at']) ?></td>
            <td>
                <?php if ($req['status'] === 'pending'): ?>
                <form method="POST" style="display:inline-flex; gap:8px; align-items:center;">
                    <input type="hidden" name="request_id" value="<?= (int)$req['request_id'] ?>">
                    <input type="hidden" name="action" value="approve">
                    <button type="submit" class="btn btn-success">Approve</button>
                </form>
                <form method="POST" style="display:inline-flex; gap:8px; align-items:center;">
                    <input type="hidden" name="request_id" value="<?= (int)$req['request_id'] ?>">
                    <input type="hidden" name="action" value="reject">
                    <button type="submit" class="btn btn-secondary">Reject</button>
                </form>
                <?php endif; ?>
                <?php /* Nothing shown once a request has been decided. The
                          Status column two cells over already says Approved or
                          Rejected, so a second word repeating it added noise
                          without adding meaning, and there is no action left
                          to offer. */ ?>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
</div>

<?php if ($is_admin): ?>
<!-- ============ Staff address requests (admin review queue) ============ -->
<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Staff Requests (<?= count($staff_requests) ?>)</h3>
        <?php if ($staff_pending > 0): ?>
        <span class="badge badge-pending"><?= $staff_pending ?> pending</span>
        <?php endif; ?>
    </div>

    <?php if (!$staff_requests): ?>
        <div class="alert alert-info alert-spaced">
            <?= $is_admin
                ? 'No staff address changes have been requested.'
                : 'You have not requested an address change. Edit your permanent address on My Profile to raise one.' ?>
        </div>
    <?php else: ?>
    <table>
        <tr>
            <th>Staff</th>
            <th>Current Address</th>
            <th>Requested Address</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Submitted</th>
            <th></th>
        </tr>
        <?php foreach ($staff_requests as $sr):
            $badge = $sr['status'] === 'pending' ? 'badge-pending' : ($sr['status'] === 'approved' ? 'badge-approved' : 'badge-rejected');
        ?>
        <tr>
            <td>
                <?= h($sr['staff_name'] ?? '') ?>
                <div class="muted-note"><?= h($sr['staff_number'] ?? '') ?></div>
            </td>
            <td><?= $sr['previous_address'] ? h($sr['previous_address']) : 'N/A' ?></td>
            <td><?= h($sr['address']) ?></td>
            <td><?= $sr['reason'] ? h($sr['reason']) : '&mdash;' ?></td>
            <td>
                <span class="badge <?= $badge ?>"><?= h(ucfirst($sr['status'])) ?></span>
                <?php if ($sr['status'] !== 'pending' && $sr['review_comment']): ?>
                    <div class="muted-note"><?= h($sr['review_comment']) ?></div>
                <?php endif; ?>
                <?php if ($sr['status'] !== 'pending' && $sr['reviewed_by_name']): ?>
                    <div class="muted-note">by <?= h($sr['reviewed_by_name']) ?></div>
                <?php endif; ?>
            </td>
            <td><?= h($sr['submitted_at']) ?></td>
            <td>
                <?php if ($sr['status'] !== 'pending'): ?>
                    <span class="muted-note">Closed</span>
                <?php elseif (!$is_admin): ?>
                    <span class="muted-note">Awaiting admin</span>
                <?php else: ?>
                    <div class="action-buttons">
                        <button type="button" class="btn-action btn-action-success has-label"
                                data-staff-review
                                data-request-id="<?= (int)$sr['request_id'] ?>"
                                data-staff="<?= h($sr['staff_name']) ?>"
                                data-address="<?= h($sr['address']) ?>"
                                data-action="approve"><?= nav_icon('check') ?>Approve</button>
                        <button type="button" class="btn-action btn-action-danger has-label"
                                data-staff-review
                                data-request-id="<?= (int)$sr['request_id'] ?>"
                                data-staff="<?= h($sr['staff_name']) ?>"
                                data-address="<?= h($sr['address']) ?>"
                                data-action="reject">Reject</button>
                    </div>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php if ($is_admin): ?>
<!-- Review modal, shared by Approve and Reject -->
<div class="modal-overlay" id="staff-review-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2 id="staff-review-title">Review Address Change</h2>
        <p class="modal-text" id="staff-review-body"></p>

        <form method="POST">
            <input type="hidden" name="staff_request_id" id="staff-review-id" value="">
            <input type="hidden" name="action" id="staff-review-action" value="">

            <label for="review_comment">Note <span class="req" id="staff-review-req">*</span></label>
            <input type="text" id="review_comment" name="review_comment" maxlength="255"
                   placeholder="Why you are approving or rejecting this">

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit" id="staff-review-submit">Confirm</button>
            </div>
        </form>
    </div>
</div>

<?php /* ---------- Resident family & household change requests ---------- */ ?>
<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Family &amp; Household Requests (<?= count($family_requests) ?>)</h3>
    </div>

    <?php if (!$family_requests): ?>
        <div class="alert alert-info">No family or household changes have been requested.</div>
    <?php else: ?>
        <?php foreach ($family_requests as $fr):
            $proposed = $fr['decoded'];
            $resident_label = trim($fr['first_name'] . ' ' . $fr['middle_name'] . ' ' . $fr['last_name']);
            $badge = $fr['status'] === 'pending' ? 'badge-pending'
                   : ($fr['status'] === 'approved' ? 'badge-approved' : 'badge-rejected');
        ?>
        <div class="person-row">
            <div class="person-row-head">
                <span class="person-row-title">
                    <?= h($resident_label) ?> &middot; <?= h($fr['resident_number']) ?>
                </span>
                <span class="badge <?= $badge ?>"><?= h(ucfirst($fr['status'])) ?></span>
            </div>

            <p class="muted-note">
                <strong>Reason given:</strong> <?= h($fr['reason'] ?? '') ?><br>
                Requested <?= h(date('M j, Y g:i A', strtotime($fr['requested_at']))) ?>.
                <?php if ($fr['status'] !== 'pending' && $fr['reviewed_by_name']): ?>
                    <br><?= h(ucfirst($fr['status'])) ?> by <?= h($fr['reviewed_by_name']) ?>
                    <?= $fr['reviewed_at'] ? '&middot; ' . h(date('M j, Y g:i A', strtotime($fr['reviewed_at']))) : '' ?>
                    <?php if (trim((string)$fr['review_comment']) !== ''): ?>
                        <br><strong>Note:</strong> <?= h($fr['review_comment']) ?>
                    <?php endif; ?>
                <?php endif; ?>
            </p>

            <?php
            /* What they are proposing, laid out so a decision can be made
               without opening another page. */
            $show_person = function ($heading, $parts) {
                $full = format_person_name($parts);
                if ($full === '') { return; }
                echo '<tr><th>' . h($heading) . '</th><td>' . h($full)
                   . ($parts['gender'] ?? '' ? ' &middot; ' . h(person_field_display('gender', $parts['gender'])) : '')
                   . '</td></tr>';
            };
            $person_of = function ($prefix) use ($proposed) {
                $parts = [];
                foreach (person_field_keys() as $field) {
                    $parts[$field] = $proposed[$prefix . '_' . $field] ?? '';
                }
                return $parts;
            };
            ?>
            <table class="table-spaced">
                <tr><th>Occupation</th><td><?= h(person_field_display('occupation', $proposed['occupation'] ?? '')) ?></td></tr>
                <tr><th>Hotline Number</th><td><?= h(person_field_display('hotline_number', $proposed['hotline_number'] ?? '')) ?></td></tr>
                <tr><th>Marital Status</th><td><?= !empty($proposed['is_married']) ? 'Married' : 'Not married' ?></td></tr>
                <?php
                if (!empty($proposed['is_married'])) { $show_person('Spouse', $person_of('spouse')); }
                $show_person('Father', $person_of('father'));
                $show_person('Mother', $person_of('mother'));
                foreach (($proposed['children'] ?? []) as $i => $row) {
                    $show_person('Child ' . ($i + 1), $row);
                }
                foreach (($proposed['references'] ?? []) as $i => $row) {
                    $show_person('Character Reference ' . ($i + 1), $row);
                }
                ?>
            </table>

            <?php if ($fr['status'] === 'pending'): ?>
            <form method="POST" class="inline-review-form">
                <input type="hidden" name="family_request_id" value="<?= (int)$fr['request_id'] ?>">
                <label for="family_comment_<?= (int)$fr['request_id'] ?>">Note for the resident</label>
                <input type="text" id="family_comment_<?= (int)$fr['request_id'] ?>" name="family_comment"
                       maxlength="255" placeholder="e.g. Approved, spelling corrected">
                <div class="action-buttons" style="margin-top:10px;">
                    <button type="submit" name="family_action" value="approve" class="btn">Approve</button>
                    <button type="submit" name="family_action" value="reject" class="btn btn-secondary">Reject</button>
                </div>
            </form>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<script>
(function () {
    var modal = document.getElementById('staff-review-modal');
    if (!modal) { return; }

    var title = document.getElementById('staff-review-title');
    var body = document.getElementById('staff-review-body');
    var idField = document.getElementById('staff-review-id');
    var actionField = document.getElementById('staff-review-action');
    var comment = document.getElementById('review_comment');
    var req = document.getElementById('staff-review-req');
    var submit = document.getElementById('staff-review-submit');

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-staff-review]');
        if (!trigger) { return; }

        var approving = trigger.getAttribute('data-action') === 'approve';
        idField.value = trigger.getAttribute('data-request-id');
        actionField.value = approving ? 'approve' : 'reject';

        title.textContent = approving ? 'Approve Address Change' : 'Reject Address Change';
        body.textContent = (approving ? 'Update ' : 'Keep the address on file for ') +
            trigger.getAttribute('data-staff') +
            (approving ? ' to: ' + trigger.getAttribute('data-address') : '.');

        // A rejection has to say why; an approval note is optional.
        comment.required = !approving;
        req.style.display = approving ? 'none' : '';
        submit.textContent = approving ? 'Approve Change' : 'Reject Request';

        comment.value = '';
        modal.classList.add('active');
    });
})();
</script>
<?php endif; ?>

<div class="modal-overlay<?= $message ? ' active' : '' ?>" id="address-request-success-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close>&times;</button>
        <div class="modal-icon-success">&#10003;</div>
        <h2>Success</h2>
        <p class="modal-text"><?= h($message) ?></p>
        <div class="modal-actions">
            <button type="button" class="btn" data-modal-close>Done</button>
        </div>
    </div>
</div>

<?php require_once '../includes/footer.php';
