<?php
/** Account operations use one Firestore snapshot, with retry on contention. */
require_once __DIR__ . '/staff-survey-store.php';
class AccountInputError extends ProfileInputError {}
function api_error(string $message, int $status = 422): void { throw new AccountInputError($message,$status); }
function ac_encode($value): array {
    if ($value === null) return ['nullValue' => null];
    if ($value instanceof DateTimeInterface) return ['timestampValue' => $value->format('Y-m-d\TH:i:s\Z')];
    if (is_bool($value)) return ['booleanValue' => $value];
    if (is_int($value)) return ['integerValue' => (string)$value];
    if (is_array($value)) return ['mapValue' => ['fields' => (object)array_map('ac_encode', $value)]];
    return fb_string($value);
}
function ac_write(string $path, array $data, bool $merge = false, array $timestamps = []): array {
    ac_bounds($data);
    $write = ['update' => ['name' => fb_name($path), 'fields' => (object)array_map('ac_encode', $data)]];
    if ($merge) $write['updateMask'] = ['fieldPaths' => array_keys($data)];
    if ($timestamps) $write['updateTransforms'] = array_map(fn($key) => ['fieldPath' => $key, 'setToServerValue' => 'REQUEST_TIME'], $timestamps);
    return $write;
}
function ac_date(string $date): DateTimeImmutable {
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
    if (!$parsed || $parsed->format('Y-m-d') !== $date) profile_error('Please enter a valid date.');
    return $parsed;
}
function ac_tx(?string $actor, callable $work, bool $onboarding = false): mixed {
    $c = fb_config();
    for ($attempt = 0; $attempt < 8; $attempt++) {
        [$status, $begin] = fb_http($c['documents'] . ':beginTransaction', ['options' => ['readWrite' => (object)[]]], $c['access']);
        if ($status !== 200) throw new RuntimeException('Transaction unavailable');
        $tx = $begin['transaction'];
        try {
            $account = $actor ? ss_read('users/' . $actor, $tx) : null;
            if ($actor) {
                if (!$account || ($account['deletedAt'] ?? null) !== null || empty($account['isActive'])) api_error('Access denied.',403);
                if (ss_read('accountLocks/' . $actor, $tx)) api_error('The request could not be completed. Please try again.',409);
                if (!in_array($account['role'], ['staff','admin'], true) || $account['isFirstLogin'] || (!$onboarding && !$account['profileCompleted'])) api_error('Access denied.', 403);
            }
            [$writes, $data] = $work($tx, $account);
            if (count($writes) > 500) profile_error('The request could not be completed. Please try again.');
            if (!$writes) { fb_http($c['documents'] . ':rollback', ['transaction' => $tx], $c['access']); return $data; }
            [$status] = fb_http($c['documents'] . ':commit', ['transaction' => $tx, 'writes' => $writes], $c['access']);
            if ($status === 409) throw new StaffSurveyRetry('Concurrent edit');
            if ($status !== 200) throw new RuntimeException('Commit unavailable');
            return $data;
        } catch (Throwable $error) {
            fb_http($c['documents'] . ':rollback', ['transaction' => $tx], $c['access']);
            if ($error instanceof StaffSurveyRetry) continue;
            throw $error;
        }
    }
    throw new RuntimeException('Concurrent edit; retry');
}
function ac_admin(?array $a): void { if (($a['role'] ?? '') !== 'admin') api_error('Access denied.', 403); }
function ac_auth(string $method, array $body): array {
    $c = fb_config();
    return fb_http($c['auth'] . '/projects/' . rawurlencode($c['project']) . '/accounts:' . $method, $body, $c['access']);
}
function ac_auth_create(array $body): array {
    $c = fb_config();
    return fb_http($c['auth'] . '/accounts:signUp?key=' . rawurlencode($c['key']), $body + ['targetProjectId' => $c['project']], $c['access']);
}
function ac_operation(array $input): string {
    $id = $input['operationId'] ?? '';
    if (!is_string($id) || !preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i', $id)) api_error('Invalid request.');
    return strtolower($id);
}
function ac_people_writes(string $parent, array $groups, string $tx = ''): array {
    $writes = [];
    foreach ($groups as $collection => $rows) {
        if ($tx) foreach (ss_query($parent, $collection, $tx) as $old) {
            if (!preg_match('/\Aperson-(\d+)\z/', $old['id'], $m) || (int)$m[1] >= count($rows)) $writes[] = ss_delete($parent . '/' . $collection . '/' . $old['id']);
        }
        foreach ($rows as $index => $row) $writes[] = ac_write($parent . '/' . $collection . '/person-' . $index,
            ['person' => isset($row['firstName']) ? $row : profile_map($row, PROFILE_PERSON), 'displayOrder' => $index, 'legacyId' => null], false, ['createdAt']);
    }
    return $writes;
}

function ac_unlocked(string $uid,string $tx): void {
    if(ss_read('accountLocks/'.$uid,$tx)) api_error('The request could not be completed. Please try again.',409);
}
function ac_result(string $message='',array $data=[],array $extra=[]): array { return ['ok'=>true,'data'=>$data,'message'=>$message]+$extra; }
function ac_once(string $actor,array $input,callable $work): array {
    $op=ac_operation($input); $path='accountOperations/'.hash('sha256',$actor.':'.$op);
    $binding=$input;unset($binding['idToken'],$binding['operationId']);$fingerprint=hash('sha256',json_encode($binding));
    return ac_tx($actor,function($tx,$a)use($path,$fingerprint,$work){
        $old=ss_read($path,$tx);
        if($old){if(($old['fingerprint']??'')!==$fingerprint)api_error('Invalid request.');return [[], $old['result']];}
        [$writes,$result]=$work($tx,$a);
        $writes[]=ac_write($path,['fingerprint'=>$fingerprint,'result'=>$result,'state'=>'complete'],false,['createdAt','updatedAt']);
        return [$writes,$result];
    });
}

function ac_bounds(array $data): void {
    $limits=['email'=>100,'number'=>20,'courtesyTitle'=>20,'firstName'=>50,'middleName'=>50,'lastName'=>50,'nameExtension'=>20,'gender'=>20,'occupation'=>100,'hotlineNumber'=>30,'displayLine'=>255,'previousAddress'=>255,'reason'=>255,'reviewComment'=>255,'householdNumber'=>50,'purok'=>100,'streetHighway'=>150,'barangay'=>100,'municipality'=>100,'postalCode'=>10,'province'=>100,'licenseNumber'=>50,'legacyValue'=>150];
    foreach($data as$key=>$value){if(is_array($value))ac_bounds($value);elseif(isset($limits[$key])&&is_string($value)&&mb_strlen($value)>$limits[$key])api_error('The request could not be completed. Please try again.');}
}
