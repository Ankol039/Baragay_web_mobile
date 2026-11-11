<?php
/**
 * Resident deletion requests.
 *
 * Deleting a resident cascades to their survey responses, so the action is
 * reserved for an administrator. Staff raise a request from the Residents
 * page; this is where an administrator approves or rejects it.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Deletion Requests';
$asset_path = '../';
$error = '';
$message = get_flash('success');

$is_admin = staff_is_admin();
$me = (int)$_SESSION['staff_id'];
$my_name = $_SESSION['staff_name'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['request_id'], $_POST['action'])) {
    if (!$is_admin) {
        $error = 'Only an administrator can approve or reject a deletion request.';
    } else {
        $request_id = (int)$_POST['request_id'];
        $action = $_POST['action'] === 'approve' ? 'approved' : 'rejected';
        $review_comment = trim($_POST['review_comment'] ?? '');

        $stmt = $conn->prepare("SELECT resident_id, resident_name FROM resident_delete_requests WHERE request_id = ? AND status = 'pending' LIMIT 1");
        $stmt->bind_param('i', $request_id);
        $stmt->execute();
        $request = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$request) {
            $error = 'That request was not found, or it has already been reviewed.';
        } elseif ($action === 'rejected' && $review_comment === '') {
            // A rejection without a reason gives the requesting staff member
            // nothing to act on.
            $error = 'Give a short reason when rejecting a request.';
        } else {
            $conn->begin_transaction();

            $update = $conn->prepare("UPDATE resident_delete_requests
                                         SET status = ?, reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?, review_comment = ?
                                       WHERE request_id = ?");
            $update->bind_param('sissi', $action, $me, $my_name, $review_comment, $request_id);
            $update->execute();
            $update->close();

            if ($action === 'approved') {
                // Archive, not DELETE. Approving used to destroy the
                // resident and cascade into every survey response they had
                // submitted. It now moves the account to Deleted Accounts,
                // so an approval made in error is still reversible.
                archive_account($conn, 'residents', (int)$request['resident_id'],
                                $me, $my_name,
                                'Deletion request approved: ' . $request['resident_name']);

                // Any other pending request for the same resident is moot.
                $tidy = $conn->prepare("UPDATE resident_delete_requests
                                           SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, reviewed_by_name = ?,
                                               review_comment = 'Resolved by another request for the same resident.'
                                         WHERE resident_id = ? AND status = 'pending'");
                $tidy->bind_param('isi', $me, $my_name, $request['resident_id']);
                $tidy->execute();
                $tidy->close();
            }

            $conn->commit();

            set_flash('success', $action === 'approved'
                ? 'Request approved. ' . $request['resident_name'] . ' was moved to Deleted Accounts and can be restored from there.'
                : 'Request rejected. The record was left untouched.');
            redirect('deletion_requests.php');
        }
    }
}

$requests = [];
/*
 * The resident row is joined in so the page can say what actually became of
 * the account, rather than inferring it from a marker glued onto the end of
 * the review comment. `deleted_at` is NULL once an account has been restored,
 * and `resident_exists` separates "restored" from "record removed entirely".
 */
$result = $conn->query("
    SELECT dr.*,
           r.resident_id AS live_resident_id,
           r.deleted_at  AS live_deleted_at
    FROM resident_delete_requests dr
    LEFT JOIN residents r ON r.resident_id = dr.resident_id
    ORDER BY dr.status = 'pending' DESC, dr.requested_at DESC
");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $requests[] = $row;
    }
}

$pending_count = 0;
foreach ($requests as $r) {
    if ($r['status'] === 'pending') { $pending_count++; }
}

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Deletion Requests</h1>
        <p><?= $is_admin
            ? 'Approve or reject resident deletions raised by staff. Approving moves the resident to Deleted Accounts, where you can still restore them.'
            : 'Deletion requests you and other staff have raised. An administrator decides the outcome.' ?></p>
    </div>
</div>

<?php if ($message): ?><div class="alert alert-success"><?= h($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Requests (<?= count($requests) ?>)</h3>
        <?php if ($pending_count > 0): ?>
        <span class="badge badge-pending"><?= $pending_count ?> pending</span>
        <?php endif; ?>
    </div>

    <?php if (!$requests): ?>
        <div class="alert alert-info alert-spaced">
            No deletion requests yet. Staff raise one from the Residents page when a record
            needs to be removed rather than deactivated.
        </div>
    <?php else: ?>
    <table class="table-spaced">
        <tr>
            <th>Resident No.</th>
            <th>Name</th>
            <th>Reason</th>
            <th>Requested by</th>
            <th>Requested</th>
            <th>Status</th>
            <th>Action</th>
        </tr>
        <?php foreach ($requests as $r):
            $status = $r['status'];
            $badge = $status === 'pending' ? 'badge-pending' : ($status === 'approved' ? 'badge-approved' : 'badge-rejected');

            /*
             * The admin's note used to render as a bare line directly under
             * the badge, which made it read as part of the status: a note of
             * "Byebye" appeared to be the reason the request was approved,
             * sitting right beside the staff member's own reason in the
             * column before it. It is labelled here so it is obvious who
             * wrote it, and the restore marker that deleted_accounts.php
             * appends is pulled out of the text and shown as its own line
             * rather than left glued to the end of a sentence.
             */
            $restore_marker = '[Account later restored.]';
            $review_comment = trim((string)($r['review_comment'] ?? ''));
            $was_restored = strpos($review_comment, $restore_marker) !== false;
            if ($was_restored) {
                $review_comment = trim(str_replace($restore_marker, '', $review_comment));
            }

            // Truthful current state, from the resident row rather than the marker.
            $resident_exists = $r['live_resident_id'] !== null;
            $currently_deleted = $resident_exists && !empty($r['live_deleted_at']);
            if ($resident_exists && empty($r['live_deleted_at']) && $status === 'approved') {
                $was_restored = true;
            }

            $decided_on = !empty($r['reviewed_at'])
                ? date('M j, Y g:i A', strtotime($r['reviewed_at']))
                : '';
        ?>
        <tr>
            <td><?= h($r['resident_number'] ?? '') ?></td>
            <td><?= h($r['resident_name'] ?? '') ?></td>
            <td><?= h($r['reason']) ?></td>
            <td><?= h($r['requested_by_name'] ?? '') ?></td>
            <td><?= h($r['requested_at']) ?></td>
            <td>
                <span class="badge <?= $badge ?>"><?= h(ucfirst($status)) ?></span>

                <?php if ($status === 'pending'): ?>
                    <div class="muted-note">Waiting for an administrator.</div>
                <?php else: ?>
                    <?php if ($r['reviewed_by_name']): ?>
                        <div class="muted-note">
                            <?= $status === 'approved' ? 'Approved' : 'Rejected' ?>
                            by <?= h($r['reviewed_by_name']) ?><?= $decided_on ? ' &middot; ' . h($decided_on) : '' ?>
                        </div>
                    <?php endif; ?>

                    <?php if ($review_comment !== ''): ?>
                        <div class="muted-note">
                            <strong>Administrator's note:</strong> <?= h($review_comment) ?>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>
            </td>
            <td>
                <?php if ($status === 'pending' && $is_admin): ?>
                    <div class="action-buttons">
                        <button type="button" class="btn-action btn-action-danger has-label"
                                data-review-open
                                data-request-id="<?= (int)$r['request_id'] ?>"
                                data-resident="<?= h($r['resident_name'] . ' (' . $r['resident_number'] . ')') ?>"
                                data-reason="<?= h($r['reason']) ?>"
                                data-action="approve"><?= nav_icon('trash') ?>Approve</button>
                        <button type="button" class="btn-action btn-action-primary has-label"
                                data-review-open
                                data-request-id="<?= (int)$r['request_id'] ?>"
                                data-resident="<?= h($r['resident_name'] . ' (' . $r['resident_number'] . ')') ?>"
                                data-reason="<?= h($r['reason']) ?>"
                                data-action="reject"><?= nav_icon('check') ?>Reject</button>
                    </div>
                <?php elseif ($status === 'pending'): ?>
                    <span class="muted-note">Awaiting admin</span>

                <?php /* Decided. The column used to show a bare dash, which read
                          as a missing button rather than as a finished request.
                          It now says what became of the account, and gives the
                          administrator somewhere to go when there is somewhere
                          to go. Staff have no Deleted Accounts page, so they get
                          the wording without the link. */ ?>
                <?php elseif ($status === 'rejected'): ?>
                    <span class="muted-note">Resident kept</span>
                <?php elseif ($was_restored): ?>
                    <span class="muted-note">Account restored</span>
                <?php elseif ($currently_deleted && $is_admin): ?>
                    <a class="btn-action btn-action-primary has-label"
                       href="deleted_accounts.php"><?= nav_icon('switch') ?>In Deleted Accounts</a>
                <?php elseif ($currently_deleted): ?>
                    <span class="muted-note">Moved to Deleted Accounts</span>
                <?php else: ?>
                    <span class="muted-note">Record removed</span>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
    <?php endif; ?>
</div>

<?php if ($is_admin): ?>
<!-- Review modal, shared by Approve and Reject -->
<div class="modal-overlay" id="review-request-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <h2 id="review-title">Review Request</h2>

        <p class="modal-text" id="review-body"></p>

        <div class="alert alert-info" id="review-warning">
            Approving moves this resident to Deleted Accounts. Their survey responses are kept,
            and you can restore the account from there if this turns out to be a mistake.
        </div>

        <form method="POST">
            <input type="hidden" name="request_id" id="review-request-id" value="">
            <input type="hidden" name="action" id="review-action" value="">

            <label for="review_comment">Note <span class="req" id="review-comment-req">*</span></label>
            <input type="text" id="review_comment" name="review_comment" maxlength="255"
                   placeholder="Why you are approving or rejecting this">

            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit" id="review-submit">Confirm</button>
            </div>
        </form>
    </div>
</div>

<script>
(function () {
    var modal = document.getElementById('review-request-modal');
    if (!modal) { return; }

    var title = document.getElementById('review-title');
    var body = document.getElementById('review-body');
    var warning = document.getElementById('review-warning');
    var idField = document.getElementById('review-request-id');
    var actionField = document.getElementById('review-action');
    var comment = document.getElementById('review_comment');
    var commentReq = document.getElementById('review-comment-req');
    var submit = document.getElementById('review-submit');

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-review-open]');
        if (!trigger) { return; }

        var approving = trigger.getAttribute('data-action') === 'approve';
        var resident = trigger.getAttribute('data-resident');

        idField.value = trigger.getAttribute('data-request-id');
        actionField.value = approving ? 'approve' : 'reject';

        title.textContent = approving ? 'Approve Deletion' : 'Reject Request';
        body.textContent = (approving ? 'Delete ' : 'Keep ') + resident +
            '. Reason given: ' + trigger.getAttribute('data-reason');

        warning.style.display = approving ? '' : 'none';
        // A rejection has to say why; an approval note is optional.
        comment.required = !approving;
        commentReq.style.display = approving ? 'none' : '';
        submit.textContent = approving ? 'Move to Deleted Accounts' : 'Reject Request';

        comment.value = '';
        modal.classList.add('active');
    });
})();
</script>
<?php endif; ?>

<?php require_once '../includes/footer.php'; ?>
