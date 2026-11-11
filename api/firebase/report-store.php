<?php
/** Projected, request-local Firestore report reads. No legacy bootstrap. */
require_once __DIR__ . '/../../config/functions.php';
require_once __DIR__ . '/../lib/staff-dashboard.php'; // Pure delta/portal helpers only.
function rp_worker(?array $user): void {
    if (!$user || !in_array($user['role'] ?? '', ['staff', 'admin'], true) || empty($user['isActive'])
        || ($user['deletedAt'] ?? null) !== null || !empty($user['isFirstLogin']) || empty($user['profileCompleted'])) fb_fail('Access denied.', 403);
}
function rp_query(string $collection, array $select, string $parent = '', array $filter = [], int $limit = 0, string $order = '', bool $group = false): array {
    global $report_transaction;
    $query = ['from' => [['collectionId' => $collection, 'allDescendants' => $group]],
        'select' => ['fields' => array_map(fn($f) => ['fieldPath' => $f], $select)]];
    if ($filter) $query['where'] = ['fieldFilter' => ['field' => ['fieldPath' => $filter[0]], 'op' => 'EQUAL', 'value' => fb_string($filter[1])]];
    if ($limit) $query['limit'] = $limit;
    if ($order) $query['orderBy'] = [['field' => ['fieldPath' => $order], 'direction' => 'DESCENDING']];
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . ($parent ? '/' . $parent : '') . ':runQuery', ['structuredQuery' => $query, 'transaction' => $report_transaction], $c['access']);
    if ($status !== 200) throw new RuntimeException('Report query failed');
    $rows = [];
    foreach ($result as $item) if (isset($item['document'])) {
        $d = $item['document']; $rows[] = ['id' => basename($d['name']), ...array_map('fb_decode', $d['fields'] ?? [])];
    }
    return $rows;
}
function rp_document(string $path,array $fields):?array {
    global $report_transaction;
    $c=fb_config();
    [$status,$result]=fb_http($c['documents'].':batchGet',['documents'=>[fb_name($path)],'mask'=>['fieldPaths'=>$fields],'transaction'=>$report_transaction],$c['access']);
    if($status!==200) throw new RuntimeException('Report document unavailable');
    return isset($result[0]['found'])?array_map('fb_decode',$result[0]['found']['fields']??[]):null;
}
function rp_day(?string $value): string { return $value ? date('Y-m-d', strtotime($value)) : ''; }
function rp_label(?string $value, bool $time = false): string { return $value ? date($time ? 'M j, Y g:i A' : 'M j, Y', strtotime($value)) : ''; }
function rp_sort(array $rows, callable $compare): array { usort($rows, $compare); return $rows; }
function rp_compare(string $a, string $b): int {
    // Original utf8mb4_general_ci grouping/sorting, including case and accents.
    $fold = fn($s) => mb_strtolower(preg_replace('/\p{M}/u', '', class_exists('Normalizer') ? Normalizer::normalize($s, Normalizer::FORM_KD) : $s), 'UTF-8');
    return strcmp($fold($a), $fold($b));
}
function rp_users(): array {
    return array_column(rp_query('users', ['role','identifier','username','displayName','isActive','deletedAt','createdAt']), null, 'id');
}
function rp_residents(array $users): array {
    $profiles = rp_query('residents', ['name.firstName','name.lastName','name.gender','contact.number','birthdate','household.occupation','household.isMarried','household.hasChildren','permanentAddress.purok','residencyStatus','specialCategory','createdAt']);
    $profiles = array_values(array_filter($profiles, fn($p) => ($users[$p['id']]['role'] ?? '') === 'resident'));
    return array_column(array_map(function ($p) use ($users) {
        $u = $users[$p['id']] ?? [];
        return ['resident_id' => $p['id'], 'resident_number' => $u['identifier'] ?? '', 'first_name' => $p['name']['firstName'] ?? '',
            'last_name' => $p['name']['lastName'] ?? '', 'gender' => $p['name']['gender'] ?? '', 'birthdate' => rp_day($p['birthdate'] ?? null),
            'contact_number' => $p['contact']['number'] ?? '', 'residency_status' => $p['residencyStatus'] ?? 'permanent',
            'special_category' => $p['specialCategory'] ?? 'none', 'occupation' => $p['household']['occupation'] ?? '',
            'is_married' => !empty($p['household']['isMarried']), 'has_children' => !empty($p['household']['hasChildren']),
            'purok' => $p['permanentAddress']['purok'] ?? '', 'is_active' => (int)!empty($u['isActive']), 'deleted_at' => $u['deletedAt'] ?? null,
            'created_at' => $p['createdAt'] ?? ''];
    }, $profiles), null, 'resident_id');
}
function rp_surveys(): array {
    $rows = rp_query('surveys', ['title','description','startDate','endDate','status','createdAt','createdByUid']);
    return array_column(array_map(fn($s) => ['survey_id' => $s['id'], 'title' => $s['title'], 'description' => $s['description'] ?? '',
        'start_date' => substr($s['startDate'], 0, 10), 'end_date' => substr($s['endDate'], 0, 10), 'status' => $s['status'],
        'created_at' => $s['createdAt'], 'created_by' => $s['createdByUid'] ?? null], rp_sort($rows, fn($a,$b) => strcmp($b['createdAt'],$a['createdAt']) ?: strcmp($a['id'],$b['id']))), null, 'survey_id');
}
function rp_responses(?string $sid = null): array {
    return rp_query('responses', ['surveyId','residentUid','submittedAt','legacyId'], '', $sid === null ? [] : ['surveyId', $sid]);
}
function rp_activity(array $users, array $residents, string $event = '', bool $stored = true): array {
    $rows = rp_query('loginHistory', ['actorUid','accountType','accountRole','at','event','legacyId'], '', $event ? ['event', $event] : [], $event ? 10 : 100, 'at');
    return array_map(function ($a) use ($users,$residents,$stored) {
        $uid = $a['actorUid']; $u = $users[$uid] ?? []; $r = $residents[$uid] ?? null;
        $row = ['user_type' => $a['accountType'], 'staff_role' => $u['role'] ?? '', 'residency_status' => $r['residency_status'] ?? '',
            'person' => $a['accountType'] === 'resident' && $r ? $r['first_name'].' '.$r['last_name'] : ($u['displayName'] ?? 'User #'.preg_replace('/^(?:resident|staff)-(\d+)$/','$1',$uid)),
            'login_time' => $a['at'], 'login_time_label' => rp_label($a['at'], true), 'time_label' => rp_label($a['at'], true)];
        if ($stored) $row['account_role'] = $a['accountRole'] ?? '';
        return $row + ['type_label' => login_type_label($row)];
    }, $rows);
}
