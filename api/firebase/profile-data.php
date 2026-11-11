<?php
/** Firestore profile serialization; reuse the original PHP labels and formatters. */
require_once __DIR__ . '/../../config/functions.php'; // Helpers only; never db.php.
require_once __DIR__ . '/../lib/profile.php';
date_default_timezone_set('Asia/Manila');

const PROFILE_PERSON = ['courtesy_title' => 'courtesyTitle', 'first_name' => 'firstName', 'middle_name' => 'middleName',
    'last_name' => 'lastName', 'name_extension' => 'nameExtension', 'gender' => 'gender'];
const PROFILE_ADDRESS = ['household_number' => 'householdNumber', 'purok' => 'purok', 'street_highway' => 'streetHighway',
    'barangay' => 'barangay', 'municipality' => 'municipality', 'postal_code' => 'postalCode', 'province' => 'province'];

function profile_unmap(?array $map, array $keys): array {
    $row = [];
    foreach ($keys as $old => $new) $row[$old] = (string)($map[$new] ?? '');
    return $row;
}
function profile_map(array $row, array $keys): array {
    $map = [];
    foreach ($keys as $old => $new) $map[$new] = (string)($row[$old] ?? '');
    return $map;
}
function profile_query(string $parent, string $collection, array $filters = [], ?string $transaction = null): array {
    $query = ['from' => [['collectionId' => $collection]]];
    if ($filters) {
        $clauses = [];
        foreach ($filters as $key => $value) $clauses[] = ['fieldFilter' => ['field' => ['fieldPath' => $key], 'op' => 'EQUAL', 'value' => fb_string($value)]];
        $query['where'] = ['compositeFilter' => ['op' => 'AND', 'filters' => $clauses]];
    }
    $body = ['structuredQuery' => $query];
    if ($transaction) $body['transaction'] = $transaction;
    $c = fb_config();
    [$status, $result] = fb_http($c['documents'] . ($parent ? '/' . $parent : '') . ':runQuery', $body, $c['access']);
    if ($status !== 200) throw new RuntimeException('Firestore unavailable');
    $rows = [];
    foreach ($result as $item) if (isset($item['document'])) {
        $doc = $item['document'];
        $rows[] = ['id' => basename($doc['name']), ...array_map('fb_decode', $doc['fields'] ?? [])];
    }
    return $rows;
}
function profile_pending(string $uid, ?string $transaction = null): array {
    $filter = ['ownerUid' => $uid, 'status' => 'pending'];
    return [profile_query('', 'nameAddressRequests', $filter, $transaction), profile_query('', 'familyRequests', $filter, $transaction)];
}
function profile_data(string $uid, array $account): array {
    $p = fb_document('residents/' . $uid);
    if (!$p) throw new RuntimeException('Missing resident');
    $h = $p['household'];
    $resident = profile_unmap($p['name'], PROFILE_PERSON) + profile_unmap($p['permanentAddress'], PROFILE_ADDRESS);
    foreach (profile_unmap($p['temporaryAddress'], PROFILE_ADDRESS) as $key => $value) $resident['temp_' . $key] = $value;
    $resident += ['resident_number' => $account['identifier'], 'email' => $p['contact']['email'], 'contact_number' => $p['contact']['number'],
        'birthdate' => substr($p['birthdate'] ?? '', 0, 10), 'address' => $p['permanentAddress']['displayLine'] ?? '',
        'temporary_address' => $p['temporaryAddress']['displayLine'] ?? '', 'residency_status' => $p['residencyStatus'],
        'residence_type' => $p['residenceType'], 'occupation' => $h['occupation'], 'hotline_number' => $h['hotlineNumber'],
        'is_married' => $h['isMarried'] ? '1' : '0', 'has_children' => $h['hasChildren'] ? '1' : '0'];
    // An explicit empty value records removal and suppresses the migrated photo.
    $legacy = array_key_exists('photoDataUrl', $p) ? null : fb_document('profileImages/' . $uid);
    $resident['photo_path'] = $p['photoDataUrl'] ?? ($legacy ? 'data:image/jpeg;base64,' . $legacy['base64'] : '');
    $display = ['full_name' => with_courtesy_title($resident['courtesy_title'], build_full_name($resident['first_name'], $resident['middle_name'], $resident['last_name'], $resident['name_extension'])),
        'gender' => gender_label($resident['gender']), 'age' => get_resident_age_label($resident['birthdate']),
        'birthdate' => $resident['birthdate'] ? date('F j, Y', strtotime($resident['birthdate'])) : '', 'residence_type' => residence_type_label($p['residenceType'])];
    foreach (['spouse', 'father', 'mother'] as $who) {
        $person = profile_unmap($h[$who], PROFILE_PERSON);
        foreach ($person as $key => $value) $resident[$who . '_' . $key] = $value;
        $display[$who] = api_profile_person($person);
    }
    foreach (['children' => 'children', 'references' => 'characterReferences'] as $key => $collection) {
        $people = profile_query('residents/' . $uid, $collection);
        usort($people, fn($a, $b) => ($a['displayOrder'] <=> $b['displayOrder']) ?: strcmp($a['createdAt'], $b['createdAt']) ?: strcmp($a['id'], $b['id']));
        $resident[$key] = array_map(fn($r) => profile_unmap($r['person'], PROFILE_PERSON), $people);
        $display[$key] = array_map('api_profile_person', $resident[$key]);
    }
    [$pending, $family] = profile_pending($uid);
    usort($family, fn($a, $b) => strcmp($b['requestedAt'], $a['requestedAt']));
    $family = $family ? ['request_id' => $family[0]['id'], 'requested_at' => $family[0]['requestedAt'],
        'requested_at_label' => date('M j, Y g:i A', strtotime($family[0]['requestedAt']))] : null;
    return ['resident' => $resident, 'display' => $display, 'pending_request' => (bool)($pending || $family),
        'pending_family_request' => $family, 'today' => date('Y-m-d'), 'fields' => api_profile_metadata()];
}
