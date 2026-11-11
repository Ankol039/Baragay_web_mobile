<?php
/** Auth/Firestore saga. Private operations contain password hashes only, never plaintext. */
function ac_provision(array $input, ?string $actor, string $kind, bool $public): array {
    if ($actor) ac_tx($actor, function($tx,$a) use($kind) { if ($kind === 'staff' && $a['role'] !== 'admin') api_error('Only administrators can create staff accounts.',403); return [[],[]]; });
    $operation = ac_operation($input);
    $values = $input['values'] ?? null;
    if (!is_array($values)) api_error('Invalid request.');
    $password = $public ? ($values['password'] ?? '') : '';
    if (!is_string($password)) api_error('Invalid request.');
    unset($values['password'], $values['confirm_password']);
    if ($public) {
        $errors = password_policy_errors($password);
        if ($errors) api_error('Your new password does not meet the requirements: ' . implode('; ', $errors) . '.');
        if ($password !== ($input['values']['confirm_password'] ?? '')) api_error('New password and confirmation do not match.');
    }
    if ($kind === 'resident') [$profile, $people] = ac_resident_values($values);
    else {
        $v = profile_strings($values, array_merge(person_field_keys(), ['courtesy_title_other','date_hired']));
        if (!$v['first_name'] || !$v['last_name'] || !$v['date_hired']) api_error('First name, last name, and date hired are required.');
        if ($v['date_hired'] > date('Y-m-d')) api_error('Date hired cannot be in the future.');
        $v['courtesy_title'] = resolve_courtesy_title($v['courtesy_title'], $v['courtesy_title_other']);
        $profile = ['name' => profile_map($v, PROFILE_PERSON), 'position' => '', 'dateHired' => ac_date($v['date_hired']), 'contact' => ['email'=>'','number'=>''],
            'birthdate'=>null,'licenseNumber'=>'','address'=>profile_map([],PROFILE_ADDRESS)+['displayLine'=>''],
            'emergencyContact'=>['name'=>'','number'=>'','legacyValue'=>''],'createdByUid'=>$actor]; $people = [];
    }
    ac_bounds($profile);ac_bounds($people);
    if ($kind==='staff' && mb_strlen(ac_full($profile))>100) api_error('The request could not be completed. Please try again.');
    if (3 + array_sum(array_map('count',$people)) + 1 > 500) api_error('The request could not be completed. Please try again.');
    $display = build_full_name(...array_map(fn($key) => $profile['name'][$key], ['firstName','middleName','lastName','nameExtension']));
    $fingerprint = hash('sha256', json_encode([$kind,$public,$values], JSON_UNESCAPED_UNICODE));
    $path = 'accountOperations/' . hash('sha256', ($actor ?? 'public') . ':' . $operation);
    $op = ac_tx($actor, function($tx, $a) use ($kind,$public,$profile,$people,$display,$fingerprint,$path,$password,$actor) {
        if ($kind === 'staff') ac_admin($a);
        $old = ss_read($path, $tx);
        if ($old) {
            if (($old['fingerprint'] ?? '') !== $fingerprint || ($public && !password_verify($password, $old['passwordProof'] ?? ''))) api_error('Invalid registration continuation.', 403);
            return [[], $old];
        }
        $counterPath = 'counters/' . ($kind === 'resident' ? 'residentNumbers' : 'staffNumbers');
        $counter = ss_read($counterPath, $tx);
        // Counter absent after a fresh emulator start: never reuse migrated sequence numbers.
        $max = (int)($counter['value'] ?? 0);
        foreach ($counter ? [] : ss_query('', 'users', $tx) as $u) if (($u['role'] === 'resident') === ($kind === 'resident')) $max = max($max,(int)substr($u['identifier'],-4));
        if ($max >= 9999) api_error('The account number sequence is exhausted. Please contact the administrator.');
        $number = ($kind === 'resident' ? 'R-' : 'S-') . date('Y') . '-' . str_pad((string)($max+1),4,'0',STR_PAD_LEFT);
        $uid = $kind . '-' . bin2hex(random_bytes(16));
        $aliasPath = 'identifierAliases/' . ($kind === 'resident' ? 'residentNumber' : 'staffNumber') . '_' . hash('sha256',strtolower($number));
        if (ss_read($aliasPath,$tx)) throw new RuntimeException('Counter/alias mismatch');
        $op = ['uid'=>$uid,'identifier'=>$number,'kind'=>$kind,'actorUid'=>$actor,'fingerprint'=>$fingerprint,'public'=>$public,
            'passwordProof'=>$public ? password_hash($password,PASSWORD_DEFAULT) : '', 'state'=>'reserved'];
        return [[ac_write($counterPath,['value'=>$max+1,'lastUid'=>$uid],false,['updatedAt']), ac_write($path,$op,false,['createdAt','updatedAt'])],$op];
    });
    if ($op['state'] === 'complete') return ac_provision_result($op, $display, $profile['name']['courtesyTitle']);
    $uid=$op['uid']; $number=$op['identifier']; $email=strtolower($number).'@barangay.app';
    $password = $public ? $password : $number;
    [$status,$result] = ac_auth_create(['localId'=>$uid,'email'=>$email,'password'=>$password,'displayName'=>$display,'disabled'=>true]);
    if ($status !== 200) {
        [$lookupStatus,$lookup] = ac_auth('lookup',['localId'=>[$uid]]);
        if ($lookupStatus !== 200 || ($lookup['users'][0]['email'] ?? '') !== $email) throw new RuntimeException('Account creation unavailable');
    }
    ac_tx($actor, function($tx,$a) use($path,$op,$profile,$people,$display,$kind,$public,$uid,$number,$email) {
        if ($kind==='staff') ac_admin($a);
        $fresh=ss_read($path,$tx);
        if ($fresh['state']==='complete') return [[],[]];
        $existing=ss_read('users/'.$uid,$tx);
        if ($existing) return [[],[]];
        $user=['uid'=>$uid,'role'=>$kind,'identifier'=>$number,'username'=>$kind==='staff'?$number:'','displayName'=>$display,
            'isActive'=>false,'isFirstLogin'=>!$public,'profileCompleted'=>$kind==='resident','deletedAt'=>null,'deletedByUid'=>null,
            'deletedByName'=>'','deleteReason'=>'','legacyId'=>null];
        if ($kind==='resident') $user['selfRegistered']=$public;
        $aliasKind=$kind==='resident'?'residentNumber':'staffNumber';
        $writes=[ac_write('users/'.$uid,$user,false,['createdAt','updatedAt']),ac_write(($kind==='resident'?'residents/':'staff/').$uid,
            $profile+['uid'=>$uid,'legacyId'=>null],false,['createdAt','updatedAt']),
            ac_write('identifierAliases/'.$aliasKind.'_'.hash('sha256',strtolower($number)),['kind'=>$aliasKind,'normalizedIdentifier'=>strtolower($number),'uid'=>$uid,'authEmail'=>$email],false,['createdAt']),
            ac_write($path,['state'=>'profileReady'],true,['updatedAt'])];
        return [[...$writes,...ac_people_writes(($kind==='resident'?'residents/':'staff/').$uid,$people)],[]];
    });
    [$status] = ac_auth('update',['localId'=>$uid,'disableUser'=>false]);
    if ($status!==200) throw new RuntimeException('Account activation unavailable');
    ac_tx($actor,function($tx,$a) use($path,$uid,$kind) {
        if ($kind==='staff') ac_admin($a);
        $fresh=ss_read($path,$tx);
        if ($fresh['state']==='complete') return [[],[]];
        return [[ac_write('users/'.$uid,['isActive'=>true],true,['updatedAt']),ac_write($path,['state'=>'complete'],true,['updatedAt'])],[]];
    });
    return ac_provision_result($op,$display,$profile['name']['courtesyTitle']);
}
function ac_provision_result(array $op,string $display,string $title): array {
    if ($op['kind']==='staff') return ['ok'=>true,'data'=>['uid'=>$op['uid'],'new_staff'=>['full_name'=>with_courtesy_title($title,$display),'staff_number'=>$op['identifier']]],'message'=>'Staff account created for '.$display.'.'];
    return ['ok'=>true,'data'=>['uid'=>$op['uid'],'resident_id'=>$op['uid'],'resident_number'=>$op['identifier']],
        'message'=>$op['public']?'Account created successfully.':'Resident added successfully. Their auto-generated Resident Number (and default password) is: '];
}
function ac_reset(array $input,string $actor,string $kind): array {
    $id=ss_id($input['targetUid']??''); $operation=ac_operation($input);
    $path='accountOperations/'.hash('sha256',$actor.':'.$operation);
    $op=ac_tx($actor,function($tx,$a) use($id,$kind,$path,$actor) {
        if ($kind==='staff') { if($a['role']!=='admin')api_error('Only administrators can reset a staff password.',403); if ($id===$actor) api_error('Use Change Password to update your own password.'); }
        $u=ss_read('users/'.$id,$tx);
        if (!$u || (($u['role']==='resident')!==($kind==='resident')) || $u['deletedAt']!==null) api_error('That '.$kind.' account could not be found.');
        $old=ss_read($path,$tx);
        if ($old) { if (($old['targetUid']??'')!==$id || ($old['kind']??'')!==$kind || ($old['type']??'')!=='reset') api_error('Invalid request.'); return [[], $old]; }
        $lock=ss_read('accountLocks/'.$id,$tx);
        if ($lock) api_error('The request could not be completed. Please try again.',409);
        $op=['type'=>'reset','targetUid'=>$id,'kind'=>$kind,'identifier'=>$u['identifier'],'wasActive'=>$u['isActive'],'state'=>'pending'];
        return [[ac_write($path,$op,false,['createdAt','updatedAt']),ac_write('accountLocks/'.$id,['operationPath'=>$path]),
            ac_write('users/'.$id,['isActive'=>false,'isFirstLogin'=>true],true,['updatedAt'])],$op];
    });
    if ($op['state']!=='complete') {
        [$status]=ac_auth('update',['localId'=>$id,'password'=>$op['identifier'],'disableUser'=>!$op['wasActive'],'validSince'=>(string)time()]);
        if ($status!==200) throw new RuntimeException('Password reset unavailable');
        ac_tx($actor,function($tx,$a) use($id,$path,$op,$kind) {
            if ($kind==='staff') ac_admin($a);
            $fresh=ss_read($path,$tx); if ($fresh['state']==='complete') return [[],[]];
            $target=ss_read('users/'.$id,$tx); $lock=ss_read('accountLocks/'.$id,$tx);
            if (!$target || $target['deletedAt']!==null || ($lock['operationPath']??'')!==$path) api_error('The request could not be completed. Please try again.',409);
            return [[ac_write('users/'.$id,['isActive'=>$op['wasActive'],'isFirstLogin'=>true],true,['updatedAt']),
                ac_write($path,['state'=>'complete'],true,['updatedAt']),ss_delete('accountLocks/'.$id)],[]];
        });
    }
    return ['ok'=>true,'data'=>[],'message'=>$kind==='resident'?'Password reset to default (resident number).':
        'Password reset to the Staff Number ('.$op['identifier'].'). They will be asked to set a new one at their next login.'];
}
