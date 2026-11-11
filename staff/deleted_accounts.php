<?php
/**
 * Deleted Accounts — the archive, and the only way back from a deletion.
 *
 * Deleting a resident or a staff account no longer removes anything. It
 * stamps deleted_at on the row, which takes the account out of every
 * listing and refuses its login, and lands it here. An administrator can
 * restore it, which puts the account and its survey history back exactly
 * as they were.
 *
 * Admin only, enforced server-side by require_admin_login(): restoring an
 * account is a change to who can sign in, so it is not a staff action.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_admin_login();

$page_title = 'Deleted Accounts';
$asset_path = '../';
$error = '';
$message = get_flash('success');

$me = (int)$_SESSION['staff_id'];
$my_name = $_SESSION['staff_name'] ?? '';

/* ------------------------------------------------------------------
   Restore — put an archived account back into service.
   ------------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['restore'], $_POST['kind'], $_POST['id'])) {
    $kind = $_POST['kind'] === 'staff' ? 'staff' : 'residents';
    $id = (int)$_POST['id'];

    if (restore_account($conn, $kind, $id)) {
        // A resident who is restored may still have an old deletion request
        // sitting at "approved". Reopening it would ask the administrator to
        // decide again, so it is marked as settled instead.
        if ($kind === 'residents') {
            $tidy = $conn->prepare("UPDATE resident_delete_requests
                                       SET review_comment = CONCAT(COALESCE(review_comment, ''), ' [Account later restored.]')
                                     WHERE resident_id = ? AND status = 'approved'
                                       AND review_comment NOT LIKE '%[Account later restored.]%'");
            $tidy->bind_param('i', $id);
            $tidy->execute();
            $tidy->close();
        }

        set_flash('success', 'Account restored. It can sign in again and its records are back in the lists.');
    } else {
        set_flash('success', 'That account was not found in the archive, or it has already been restored.');
    }
    redirect('deleted_accounts.php');
}

/* ------------------------------------------------------------------
   Delete permanently — the genuinely irreversible one.

   Kept behind the archive on purpose: an account has to be deleted once
   to get here, and deleted again from here, so it cannot be destroyed by
   a single misplaced click. For a resident this does cascade into their
   survey responses, which is why the confirmation says so.
   ------------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['purge'], $_POST['kind'], $_POST['id'])) {
    $kind = $_POST['kind'] === 'staff' ? 'staff' : 'residents';
    $id = (int)$_POST['id'];

    if ($kind === 'staff' && $id === $me) {
        $error = 'You cannot permanently delete the account you are signed in with.';
    } else {
        $sql = $kind === 'staff'
            ? "DELETE FROM staff WHERE staff_id = ? AND deleted_at IS NOT NULL"
            : "DELETE FROM residents WHERE resident_id = ? AND deleted_at IS NOT NULL";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $gone = $stmt->affected_rows > 0;
        $stmt->close();

        set_flash('success', $gone
            ? 'Account permanently deleted. This one cannot be undone.'
            : 'That account was not found in the archive.');
        redirect('deleted_accounts.php');
    }
}

/* ---------------------------- Load the archive ---------------------------- */
$deleted_residents = [];
$res = $conn->query("
    SELECT r.resident_id, r.resident_number, r.courtesy_title, r.first_name, r.last_name,
           r.residency_status, r.contact_number, r.deleted_at, r.deleted_by_name, r.delete_reason,
           (SELECT COUNT(*) FROM responses rs WHERE rs.resident_id = r.resident_id) AS response_count
    FROM residents r
    WHERE r.deleted_at IS NOT NULL
    ORDER BY r.deleted_at DESC
");
if ($res) {
    while ($row = $res->fetch_assoc()) { $deleted_residents[] = $row; }
}

$deleted_staff = [];
$res = $conn->query("
    SELECT staff_id, staff_number, username, courtesy_title, full_name, role,
           deleted_at, deleted_by_name, delete_reason
    FROM staff
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
");
if ($res) {
    while ($row = $res->fetch_assoc()) { $deleted_staff[] = $row; }
}

$total_archived = count($deleted_residents) + count($deleted_staff);

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Deleted Accounts</h1>
        <p>Residents and staff that have been deleted. Restoring puts an account back with its records intact.</p>
    </div>
</div>

<?php if ($message): ?><div class="alert alert-success"><?= h($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-error"><?= h($error) ?></div><?php endif; ?>

<?php if ($total_archived === 0): ?>
<div class="card">
    <div class="alert alert-info alert-spaced">
        Nothing has been deleted. When a resident or staff account is deleted it lands here
        first, so it can always be brought back.
    </div>
</div>
<?php endif; ?>

<?php if ($deleted_residents): ?>
<div class="card">
    <div class="card-head">
        <h3 class="card-head-title">Deleted Residents (<?= count($deleted_residents) ?>)</h3>
    </div>
    <table class="table-spaced">
        <tr>
            <th>Resident No.</th>
            <th>Name</th>
            <th>Residency</th>
            <th>Responses Held</th>
            <th>Deleted</th>
            <th>Action</th>
        </tr>
        <?php foreach ($deleted_residents as $r):
            $name = trim($r['first_name'] . ' ' . $r['last_name']);
            $display = with_courtesy_title($r['courtesy_title'] ?? '', $name);
        ?>
        <tr>
            <td><?= h($r['resident_number']) ?></td>
            <td><?= h($display) ?></td>
            <td>
                <span class="badge <?= ($r['residency_status'] ?? '') === 'temporary' ? 'badge-temporary' : 'badge-permanent' ?>">
                    <?= h(ucfirst($r['residency_status'] ?: 'permanent')) ?>
                </span>
            </td>
            <td>
                <?php // The reason the old hard delete was so costly: these
                      // go with the account. They are still attached. ?>
                <?= (int)$r['response_count'] ?>
            </td>
            <td>
                <?= h(date('M j, Y g:i A', strtotime($r['deleted_at']))) ?>
                <?php if ($r['deleted_by_name']): ?>
                    <div class="muted-note">by <?= h($r['deleted_by_name']) ?></div>
                <?php endif; ?>
                <?php if ($r['delete_reason']): ?>
                    <div class="muted-note"><?= h($r['delete_reason']) ?></div>
                <?php endif; ?>
            </td>
            <td>
                <div class="action-buttons">
                    <form method="POST" class="inline-select-form">
                        <input type="hidden" name="restore" value="1">
                        <input type="hidden" name="kind" value="residents">
                        <input type="hidden" name="id" value="<?= (int)$r['resident_id'] ?>">
                        <button type="submit" class="btn-action btn-action-primary has-label"
                                title="Restore this resident"><?= nav_icon('switch') ?>Restore</button>
                    </form>
                    <button type="button" class="btn-action btn-action-danger has-label"
                            data-purge-open
                            data-kind="residents"
                            data-id="<?= (int)$r['resident_id'] ?>"
                            data-name="<?= h($display . ' (' . $r['resident_number'] . ')') ?>"
                            data-extra="<?= (int)$r['response_count'] ?> survey response<?= (int)$r['response_count'] === 1 ? '' : 's' ?> will also be destroyed."
                            title="Delete permanently"><?= nav_icon('trash') ?>Delete Forever</button>
                </div>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>

<?php if ($deleted_staff): ?>
<div class="card section-spaced">
    <div class="card-head">
        <h3 class="card-head-title">Deleted Staff Accounts (<?= count($deleted_staff) ?>)</h3>
    </div>
    <table class="table-spaced">
        <tr>
            <th>Staff No.</th>
            <th>Name</th>
            <th>Role</th>
            <th>Deleted</th>
            <th>Action</th>
        </tr>
        <?php foreach ($deleted_staff as $s):
            $display = with_courtesy_title($s['courtesy_title'] ?? '', $s['full_name']);
        ?>
        <tr>
            <td><?= h($s['staff_number'] ?: '—') ?></td>
            <td>
                <?= h($display) ?>
                <div class="muted-note"><?= h($s['username']) ?></div>
            </td>
            <td>
                <span class="badge <?= strtolower($s['role']) === 'admin' ? 'badge-role-admin' : 'badge-role-staff' ?>">
                    <?= h(ucfirst($s['role'])) ?>
                </span>
            </td>
            <td>
                <?= h(date('M j, Y g:i A', strtotime($s['deleted_at']))) ?>
                <?php if ($s['deleted_by_name']): ?>
                    <div class="muted-note">by <?= h($s['deleted_by_name']) ?></div>
                <?php endif; ?>
                <?php if ($s['delete_reason']): ?>
                    <div class="muted-note"><?= h($s['delete_reason']) ?></div>
                <?php endif; ?>
            </td>
            <td>
                <div class="action-buttons">
                    <form method="POST" class="inline-select-form">
                        <input type="hidden" name="restore" value="1">
                        <input type="hidden" name="kind" value="staff">
                        <input type="hidden" name="id" value="<?= (int)$s['staff_id'] ?>">
                        <button type="submit" class="btn-action btn-action-primary has-label"
                                title="Restore this staff account"><?= nav_icon('switch') ?>Restore</button>
                    </form>
                    <button type="button" class="btn-action btn-action-danger has-label"
                            data-purge-open
                            data-kind="staff"
                            data-id="<?= (int)$s['staff_id'] ?>"
                            data-name="<?= h($display . ' (' . ($s['staff_number'] ?: $s['username']) . ')') ?>"
                            data-extra="Their login and employment record will be destroyed."
                            title="Delete permanently"><?= nav_icon('trash') ?>Delete Forever</button>
                </div>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
</div>
<?php endif; ?>

<!-- Permanent deletion: the one action on this page with no way back -->
<div class="modal-overlay" id="purge-modal">
    <div class="modal-box modal-narrow">
        <button type="button" class="modal-close" data-modal-close aria-label="Close">&times;</button>
        <div class="modal-icon-warning">!</div>
        <h2>Delete Permanently</h2>
        <p class="modal-text" id="purge-target"></p>
        <div class="alert alert-error" id="purge-extra"></div>
        <p class="modal-text">
            This removes the record from the database for good. There is no archive behind
            this step and no way to undo it. Restore the account instead if you are unsure.
        </p>
        <form method="POST">
            <input type="hidden" name="purge" value="1">
            <input type="hidden" name="kind" id="purge-kind" value="">
            <input type="hidden" name="id" id="purge-id" value="">
            <div class="modal-form-actions">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit" class="btn btn-danger">Delete Permanently</button>
            </div>
        </form>
    </div>
</div>

<script>
(function () {
    var modal = document.getElementById('purge-modal');
    if (!modal) { return; }

    var target = document.getElementById('purge-target');
    var extra = document.getElementById('purge-extra');
    var kindField = document.getElementById('purge-kind');
    var idField = document.getElementById('purge-id');

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-purge-open]');
        if (!trigger) { return; }

        kindField.value = trigger.getAttribute('data-kind');
        idField.value = trigger.getAttribute('data-id');
        target.textContent = trigger.getAttribute('data-name');
        extra.textContent = trigger.getAttribute('data-extra');
        modal.classList.add('active');
    });
})();
</script>

<?php require_once '../includes/footer.php'; ?>
