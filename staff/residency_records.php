<?php
/**
 * Residency Records — the archive behind every permanent/temporary move.
 *
 * When a temporary resident is made permanent, the address they had on file
 * is not overwritten and lost: it is copied here first. That is what makes a
 * promotion reversible. If a claim is later disproved, the admin reverts the
 * resident and the archived address is put back exactly as it was.
 *
 * Read-only. The actions themselves live on Residents, next to the person
 * they apply to. Admin only, for the same reason the moves are: these rows
 * are the evidence trail for a change to someone's address of record.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_admin_login();

$page_title = 'Residency Records';
$asset_path = '../';

/*
 * ?filter=permanent or ?filter=temporary narrows the history to one kind of
 * move. Both summary cards link here, so clicking a total shows exactly the
 * rows behind that number instead of leaving the admin to scan the full log.
 */
$filter = $_GET['filter'] ?? '';
if (!in_array($filter, ['permanent', 'temporary'], true)) {
    $filter = '';
}

$changes = [];
$result = $conn->query("
    SELECT c.*,
           r.resident_number, r.first_name, r.last_name, r.residency_status,
           s.full_name AS changed_by_name
    FROM resident_residency_changes c
    LEFT JOIN residents r ON r.resident_id = c.resident_id
    LEFT JOIN staff s     ON s.staff_id = c.changed_by
    ORDER BY c.changed_at DESC, c.change_id DESC
");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $changes[] = $row;
    }
}

$promotions = 0;
$reversions = 0;
foreach ($changes as $c) {
    if ($c['to_status'] === 'permanent') { $promotions++; } else { $reversions++; }
}

// Counts always reflect the whole log; only the table below is filtered.
$visible_changes = $changes;
if ($filter !== '') {
    $visible_changes = array_values(array_filter($changes, function ($c) use ($filter) {
        return $c['to_status'] === $filter;
    }));
}

$filter_titles = [
    ''          => 'Change History',
    'permanent' => 'Made Permanent',
    'temporary' => 'Reverted to Temporary',
];
$filter_notes = [
    ''          => 'Newest first. An archived address stays here even after the resident is deleted.',
    'permanent' => 'Residents who were moved from temporary to permanent, newest first.',
    'temporary' => 'Residents who were returned to temporary status, newest first.',
];

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Residency Records</h1>
        <p>Every move between temporary and permanent status, with the address that was on file at the time.</p>
    </div>
</div>

<?php if ($filter !== ''): ?>
<?php // Return path out of a filtered view, back to the full page. ?>
<a class="back-link" href="residency_records.php">&larr; Back to Residency Records</a>
<?php endif; ?>

<div class="grid-2 mb-4">
    <a class="stat-card stat-card-link<?= $filter === 'permanent' ? ' is-active' : '' ?>"
       href="residency_records.php?filter=permanent">
        <div class="stat-number"><?= (int)$promotions ?></div>
        <div class="stat-label">Made Permanent</div>
        <div class="stat-card-hint">View these records</div>
    </a>
    <a class="stat-card stat-card-link<?= $filter === 'temporary' ? ' is-active' : '' ?>"
       href="residency_records.php?filter=temporary">
        <div class="stat-number"><?= (int)$reversions ?></div>
        <div class="stat-label">Reverted to Temporary</div>
        <div class="stat-card-hint">View these records</div>
    </a>
</div>

<div class="card">
    <div class="card-head">
        <div>
            <h2 class="card-head-title"><?= h($filter_titles[$filter]) ?></h2>
            <p class="muted-note"><?= h($filter_notes[$filter]) ?></p>
        </div>
        <?php if ($visible_changes): ?>
        <input type="search" class="table-search" data-table-search="residency-log"
               placeholder="Search by name or resident number..."
               aria-label="Search the residency change history">
        <?php endif; ?>
    </div>

    <?php if (empty($visible_changes)): ?>
        <div class="empty-panel">
            <span class="empty-panel-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 7h18v13H3z"/><path d="M3 7l2-3h14l2 3"/><path d="M9 12h6"/>
                </svg>
            </span>
            <p class="empty-panel-title">
                <?= $filter === '' ? 'No residency changes yet' : 'Nothing in this category yet' ?>
            </p>
            <p class="empty-panel-note">
                <?= $filter === ''
                    ? 'When an administrator makes a temporary resident permanent, the address previously on file is archived here.'
                    : 'No resident has been ' . ($filter === 'permanent' ? 'made permanent' : 'reverted to temporary') . ' so far.' ?>
            </p>
        </div>
    <?php else: ?>
        <table class="table-spaced" id="residency-log">
            <tr>
                <th>Resident</th>
                <th>Status Now</th>
                <th>Change Made</th>
                <th>Address Archived</th>
                <th>Reason</th>
                <th>By</th>
                <th>When</th>
            </tr>
            <?php foreach ($visible_changes as $c): ?>
            <?php
                $person = trim(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? ''));
                if ($person === '') { $person = 'Deleted resident #' . (int)$c['resident_id']; }
                $to_permanent = $c['to_status'] === 'permanent';

                // On a promotion the archived permanent address is the useful
                // one. On a reversion it is the temporary address that was
                // put back, so show whichever actually carries the history.
                $archived = $to_permanent
                    ? (string)($c['prev_address'] ?? '')
                    : (string)($c['prev_address'] ?? '');
            ?>
            <tr data-search-text="<?= h(($c['resident_number'] ?? '') . ' ' . $person) ?>">
                <td>
                    <?= h($person) ?>
                    <?php if (!empty($c['resident_number'])): ?>
                        <br><small class="muted-note"><?= h($c['resident_number']) ?></small>
                    <?php endif; ?>
                </td>
                <td class="nowrap">
                    <?php // Where the account stands today, not at the time. ?>
                    <?php $now_temp = ($c['residency_status'] ?? '') === 'temporary'; ?>
                    <?php if (!empty($c['residency_status'])): ?>
                        <span class="badge <?= $now_temp ? 'badge-temporary' : 'badge-permanent' ?>">
                            <?= $now_temp ? 'Temporary' : 'Permanent' ?>
                        </span>
                    <?php else: ?>
                        <span class="muted-note">Deleted</span>
                    <?php endif; ?>
                </td>
                <td class="nowrap">
                    <span class="badge <?= $to_permanent ? 'badge-permanent' : 'badge-temporary' ?>">
                        <?= $to_permanent ? 'Made Permanent' : 'Reverted to Temporary' ?>
                    </span>
                    <br><small class="muted-note">
                        <?= h(ucfirst($c['from_status'])) ?> &rarr; <?= h(ucfirst($c['to_status'])) ?>
                        <?= ((int)$c['is_reverted'] === 1) ? ' &middot; later undone' : '' ?>
                    </small>
                </td>
                <td>
                    <?= $archived !== '' ? h($archived) : '<span class="muted-note">None on file</span>' ?>
                    <?php if ($to_permanent && !empty($c['prev_temporary_address'])): ?>
                        <br><small class="muted-note">Promoted from: <?= h($c['prev_temporary_address']) ?></small>
                    <?php endif; ?>
                </td>
                <td><?= !empty($c['reason']) ? h($c['reason']) : '<span class="muted-note">&mdash;</span>' ?></td>
                <td><?= !empty($c['changed_by_name']) ? h($c['changed_by_name']) : '<span class="muted-note">System</span>' ?></td>
                <td class="nowrap"><?= h(date('M j, Y g:i A', strtotime($c['changed_at']))) ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="no-match-row" style="display:none;">
                <td colspan="7" class="empty-state">No records match your search.</td>
            </tr>
        </table>
    <?php endif; ?>
</div>

<?php require_once '../includes/footer.php'; ?>
