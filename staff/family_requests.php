<?php
require_once '../config/db.php';
require_once '../config/functions.php';
require_staff_login();

$page_title = 'Family & Household Requests';
$asset_path = '../';
$error = '';
$message = '';
$me = (int)$_SESSION['staff_id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $request_id = (int)($_POST['request_id'] ?? 0);
    $action = ($_POST['action'] ?? '') === 'approve' ? 'approved' : 'rejected';
    $review_comment = trim($_POST['review_comment'] ?? '');

    $stmt = $conn->prepare("SELECT r.*, p.resident_number, p.first_name, p.last_name
        FROM resident_family_update_requests r
        JOIN residents p ON p.resident_id = r.resident_id
        WHERE r.request_id = ? AND r.status = 'pending' LIMIT 1");
    $stmt->bind_param('i', $request_id);
    $stmt->execute();
    $request = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$request) {
        $error = 'Request not found or already processed.';
    } else {
        $proposal = json_decode((string)$request['proposed_family_json'], true);
        if (!is_array($proposal)) {
            $error = 'The stored family request is invalid and could not be reviewed.';
        } elseif ($action === 'approved') {
            $occupation = trim((string)($proposal['occupation'] ?? ''));
            $hotline = trim((string)($proposal['hotline_number'] ?? ''));
            $is_married = !empty($proposal['is_married']) ? 1 : 0;
            $has_children = !empty($proposal['has_children']) ? 1 : 0;
            $spouse = collect_family_person($proposal['spouse'] ?? []);
            $father = collect_family_person($proposal['father'] ?? []);
            $mother = collect_family_person($proposal['mother'] ?? []);
            $children = $has_children ? collect_person_rows($proposal['children'] ?? []) : [];
            $references = collect_person_rows($proposal['references'] ?? []);

            if (!$is_married) {
                $spouse = collect_family_person([]);
            }

            $validation = array_merge(
                person_rows_errors($children, 'Child'),
                person_rows_errors($references, 'Character reference')
            );
            if ($is_married && $spouse['first_name'] === '') {
                $validation[] = 'The approved spouse entry is missing a first name.';
            }
            if ($is_married && $spouse['last_name'] === '') {
                $validation[] = 'The approved spouse entry is missing a surname.';
            }
            if ($has_children && empty($children)) {
                $validation[] = 'The approved request says the resident has children but contains no child.';
            }
            if (empty($references)) {
                $validation[] = 'At least one character reference is required.';
            }
            if ($hotline !== '' && !preg_match('/' . hotline_number_pattern() . '/', $hotline)) {
                $validation[] = 'The hotline number is invalid.';
            }

            if ($validation) {
                $error = $validation[0];
            } else {
                $conn->begin_transaction();
                try {
                    $update = $conn->prepare("UPDATE residents SET
                            occupation = ?, hotline_number = ?, is_married = ?,
                            spouse_courtesy_title = ?, spouse_last_name = ?, spouse_first_name = ?, spouse_middle_name = ?, spouse_name_extension = ?, spouse_gender = ?,
                            has_children = ?,
                            father_courtesy_title = ?, father_last_name = ?, father_first_name = ?, father_middle_name = ?, father_name_extension = ?, father_gender = ?,
                            mother_courtesy_title = ?, mother_last_name = ?, mother_first_name = ?, mother_middle_name = ?, mother_name_extension = ?, mother_gender = ?
                        WHERE resident_id = ?");
                    $types = 'ssi' . str_repeat('s', 6) . 'i' . str_repeat('s', 12) . 'i';
                    $update->bind_param(
                        $types,
                        $occupation, $hotline, $is_married,
                        $spouse['courtesy_title'], $spouse['last_name'], $spouse['first_name'], $spouse['middle_name'], $spouse['name_extension'], $spouse['gender'],
                        $has_children,
                        $father['courtesy_title'], $father['last_name'], $father['first_name'], $father['middle_name'], $father['name_extension'], $father['gender'],
                        $mother['courtesy_title'], $mother['last_name'], $mother['first_name'], $mother['middle_name'], $mother['name_extension'], $mother['gender'],
                        $request['resident_id']
                    );
                    $update->execute();
                    $update->close();

                    replace_person_rows($conn, 'resident_children', (int)$request['resident_id'], $children);
                    replace_person_rows($conn, 'resident_character_references', (int)$request['resident_id'], $references);

                    $close = $conn->prepare("UPDATE resident_family_update_requests
                        SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, review_comment = ?
                        WHERE request_id = ? AND status = 'pending'");
                    $close->bind_param('isi', $me, $review_comment, $request_id);
                    $close->execute();
                    $closed = $close->affected_rows === 1;
                    $close->close();
                    if (!$closed) {
                        throw new RuntimeException('The request changed while it was being reviewed.');
                    }

                    $conn->commit();
                    $message = 'Family & Household changes approved and written to the resident record shared by Admin and Staff portals.';
                } catch (Throwable $e) {
                    $conn->rollback();
                    error_log('Approving resident family request failed: ' . $e->getMessage());
                    $error = 'The family changes could not be saved. Nothing was changed.';
                }
            }
        } else {
            $close = $conn->prepare("UPDATE resident_family_update_requests
                SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, review_comment = ?
                WHERE request_id = ? AND status = 'pending'");
            $close->bind_param('isi', $me, $review_comment, $request_id);
            $close->execute();
            $closed = $close->affected_rows === 1;
            $close->close();
            $message = $closed ? 'Family & Household request rejected.' : 'The request was already processed.';
        }
    }
}

$requests = [];
$result = $conn->query("SELECT r.*, p.resident_number, p.first_name, p.middle_name, p.last_name, p.name_extension, p.courtesy_title
    FROM resident_family_update_requests r
    JOIN residents p ON p.resident_id = r.resident_id
    ORDER BY r.status = 'pending' DESC, r.submitted_at DESC");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $proposal = json_decode((string)$row['proposed_family_json'], true);
        $row['proposal'] = is_array($proposal) ? $proposal : [];
        $requests[] = $row;
    }
}

require_once '../includes/header_staff.php';
?>
<div class="page-head">
    <div class="page-head-text">
        <h1>Family &amp; Household Requests</h1>
        <p>Review resident changes to occupation, household members, parents, children and character references.</p>
    </div>
</div>

<?php if ($message): ?><div class="alert alert-success alert-spaced"><?= h($message) ?></div><?php endif; ?>
<?php if ($error): ?><div class="alert alert-error alert-spaced"><?= h($error) ?></div><?php endif; ?>

<div class="card">
    <div class="table-wrap">
        <table class="table-spaced">
            <thead>
                <tr>
                    <th>Resident</th>
                    <th>Requested Changes</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Review</th>
                </tr>
            </thead>
            <tbody>
            <?php if (!$requests): ?>
                <tr><td colspan="5" class="empty-state">No Family &amp; Household requests yet.</td></tr>
            <?php else: foreach ($requests as $row):
                $proposal = $row['proposal'];
                $spouse = $proposal['spouse'] ?? [];
                $father = $proposal['father'] ?? [];
                $mother = $proposal['mother'] ?? [];
                $children = $proposal['children'] ?? [];
                $references = $proposal['references'] ?? [];
                $resident_display = with_courtesy_title($row['courtesy_title'] ?? '', build_full_name($row['first_name'], $row['middle_name'] ?? '', $row['last_name'], $row['name_extension'] ?? ''));
            ?>
                <tr>
                    <td>
                        <strong><?= h($resident_display) ?></strong><br>
                        <span class="muted-note"><?= h($row['resident_number']) ?></span>
                    </td>
                    <td>
                        <div><strong>Occupation:</strong> <?= h($proposal['occupation'] ?? 'N/A') ?></div>
                        <div><strong>Marital:</strong> <?= !empty($proposal['is_married']) ? 'Married' : 'Not married' ?></div>
                        <?php if (!empty($proposal['is_married'])): ?><div><strong>Spouse:</strong> <?= h(with_courtesy_title($spouse['courtesy_title'] ?? '', format_person_name($spouse))) ?></div><?php endif; ?>
                        <div><strong>Father:</strong> <?= h(with_courtesy_title($father['courtesy_title'] ?? '', format_person_name($father))) ?: 'N/A' ?></div>
                        <div><strong>Mother:</strong> <?= h(with_courtesy_title($mother['courtesy_title'] ?? '', format_person_name($mother))) ?: 'N/A' ?></div>
                        <div><strong>Children:</strong> <?= count($children) ?> &nbsp; <strong>References:</strong> <?= count($references) ?></div>
                        <details style="margin-top:8px;">
                            <summary>View full proposed details</summary>
                            <div class="family-person-grid" style="margin-top:8px;">
                                <?php foreach ([['label' => 'Spouse', 'person' => $spouse], ['label' => 'Father', 'person' => $father], ['label' => 'Mother', 'person' => $mother]] as $person_item): ?>
                                    <?php $fp = $person_item['person']; ?>
                                    <div><span><?= h($person_item['label']) ?></span><strong><?= h(with_courtesy_title($fp['courtesy_title'] ?? '', format_person_name($fp))) ?: 'N/A' ?></strong><small><?= h(gender_label($fp['gender'] ?? '')) ?></small></div>
                                <?php endforeach; ?>
                            </div>
                            <?php foreach (['Child' => $children, 'Character Reference' => $references] as $noun => $people): ?>
                                <?php if ($people): ?><div style="margin-top:8px;"><strong><?= h($noun) ?> details</strong></div><?php endif; ?>
                                <?php foreach ($people as $i => $fp): ?>
                                    <div class="muted-note"><?= h($noun) ?> <?= (int)$i + 1 ?>: <?= h(with_courtesy_title($fp['courtesy_title'] ?? '', format_person_name($fp))) ?: 'N/A' ?> — <?= h(gender_label($fp['gender'] ?? '')) ?></div>
                                <?php endforeach; ?>
                            <?php endforeach; ?>
                        </details>
                    </td>
                    <td><?= h(date('M j, Y g:i A', strtotime($row['submitted_at']))) ?></td>
                    <td>
                        <?php $badge = $row['status'] === 'pending' ? 'badge-pending' : ($row['status'] === 'approved' ? 'badge-approved' : 'badge-rejected'); ?>
                        <span class="badge <?= $badge ?>"><?= h(ucfirst($row['status'])) ?></span>
                        <?php if (!empty($row['review_comment'])): ?><div class="muted-note" style="margin-top:6px;"><?= h($row['review_comment']) ?></div><?php endif; ?>
                    </td>
                    <td>
                        <?php if ($row['status'] === 'pending'): ?>
                        <form method="POST" class="review-inline-form">
                            <input type="hidden" name="request_id" value="<?= (int)$row['request_id'] ?>">
                            <input type="text" name="review_comment" maxlength="255" placeholder="Optional review note">
                            <div class="modal-form-actions">
                                <button type="submit" name="action" value="approve" class="btn btn-success">Approve</button>
                                <button type="submit" name="action" value="reject" class="btn btn-secondary">Reject</button>
                            </div>
                        </form>
                        <?php else: ?>
                            <span class="muted-note">Reviewed <?= $row['reviewed_at'] ? h(date('M j, Y g:i A', strtotime($row['reviewed_at']))) : '' ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
</div>

<?php require_once '../includes/footer.php'; ?>
