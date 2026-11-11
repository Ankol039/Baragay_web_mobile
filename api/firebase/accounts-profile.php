<?php
/** Staff onboarding and later address corrections preserve the original form policy. */
function ac_staff_data(string $uid,array $u,string $tx): array {
    $p=ss_read('staff/'.$uid,$tx);if(!$p)throw new RuntimeException('Missing staff profile');
    $a=profile_unmap($p['address'],PROFILE_ADDRESS)+['staff_number'=>$u['identifier'],'username'=>$u['username'],'full_name'=>$u['displayName'],'courtesy_title'=>$p['name']['courtesyTitle'],'date_hired'=>substr($p['dateHired']??'',0,10),'role'=>$u['role'],'contact_number'=>$p['contact']['number'],'email'=>$p['contact']['email'],'birthdate'=>substr($p['birthdate']??'',0,10),'gender'=>$p['name']['gender'],'license_number'=>$p['licenseNumber'],'address'=>$p['address']['displayLine'],'emergency_contact_name'=>$p['emergencyContact']['name'],'emergency_contact_number'=>$p['emergencyContact']['number'],'is_first_login'=>$u['isFirstLogin'],'profile_completed'=>$u['profileCompleted'],'display_name'=>with_courtesy_title($p['name']['courtesyTitle'],$u['displayName'])];
    $legacy=array_key_exists('photoDataUrl',$p)?null:ss_read('profileImages/'.$uid,$tx);$a['photo_path']=$p['photoDataUrl']??($legacy?'data:image/jpeg;base64,'.$legacy['base64']:'');
    $pending=$u['role']==='admin'?[]:profile_query('','staffRequests',['ownerUid'=>$uid,'status'=>'pending'],$tx);usort($pending,fn($x,$y)=>strcmp($y['requestedAt'],$x['requestedAt']));
    return ['account'=>$a,'pending_request'=>$pending?['address'=>$pending[0]['proposed']['displayLine'],'submitted_at'=>date('Y-m-d H:i:s',strtotime($pending[0]['requestedAt']))]:null,'is_admin'=>$u['role']==='admin','onboarding'=>$u['role']!=='admin'&&!$u['profileCompleted'],'today'=>date('Y-m-d'),'genders'=>gender_options(),'address_fields'=>api_staff_address_fields()];
}
function ac_staff_profile(string $action,array $input,string $actor): array {
    $result=ac_tx($actor,function($tx,$a)use($action,$input,$actor){
        if($action==='staffProfile')return [[],ac_result('',ac_staff_data($actor,$a,$tx))];
        $p=ss_read('staff/'.$actor,$tx);$writes=[];$outcome='normal';
        if(in_array($action,['staffPhoto','staffRemovePhoto'],true)){
            $photo=$action==='staffPhoto'?profile_photo($input):'';
            $writes=[ac_write('staff/'.$actor,['photoDataUrl'=>$photo],true,['updatedAt']),ss_delete('profileImages/'.$actor)];
        }else{
            if($a['role']==='admin')api_error('Access denied.',403);
            $v=profile_strings($input,array_merge(['contact_number','email','birthdate','gender','license_number','emergency_contact_name','emergency_contact_number','reason'],address_field_names()));
            $onboarding=!$a['profileCompleted'];$pending=profile_query('','staffRequests',['ownerUid'=>$actor,'status'=>'pending'],$tx);$locked=!$onboarding&&(bool)$pending;
            $address=profile_map($v,PROFILE_ADDRESS)+['displayLine'=>build_address_line(...array_map(fn($k)=>$v[$k],address_field_names()))];$changed=!$onboarding&&!$locked&&$address['displayLine']!==$p['address']['displayLine'];
            if(!$v['contact_number'])api_error('Contact number is required.');
            if(!preg_match('/^[0-9+()\-\s]{7,20}$/',$v['contact_number']))api_error('Enter a contact number using digits, spaces, and + ( ) - only.');
            if($v['email']&&!filter_var($v['email'],FILTER_VALIDATE_EMAIL))api_error('Enter a valid email address, or leave the field blank.');
            if($v['birthdate']&&$v['birthdate']>=date('Y-m-d'))api_error('Birthdate must be in the past.');
            if(mb_strlen($v['license_number'])>50)api_error('That license number is too long (50 characters maximum).');
            if($v['license_number']&&!preg_match('/^[A-Za-z0-9\-\s\/]+$/',$v['license_number']))api_error('Enter a license number using letters, digits, spaces, and - / only.');
            if($v['emergency_contact_number']&&!preg_match('/^[0-9+()\-\s]{7,20}$/',$v['emergency_contact_number']))api_error('Enter an emergency contact number using digits, spaces, and + ( ) - only.');
            if(!$locked&&(!$v['household_number']||!$v['barangay']||!$v['municipality']||!$v['province']))api_error('Household Number, Barangay, Municipality/City, and Province are required.');
            if(!$locked&&$v['postal_code']&&!preg_match('/^\d{4}$/',$v['postal_code']))api_error('A Philippine postal code is four digits.');
            if($changed&&!$v['reason'])api_error('Give a short reason for the address change so the administrator can act on it.');
            $name=$p['name'];$name['gender']=array_key_exists($v['gender'],gender_options())?$v['gender']:'';
            $next=['name'=>$name,'contact'=>['email'=>$v['email'],'number'=>$v['contact_number']],'birthdate'=>$v['birthdate']?ac_date($v['birthdate']):null,'licenseNumber'=>$v['license_number'],'emergencyContact'=>['name'=>$v['emergency_contact_name'],'number'=>$v['emergency_contact_number'],'legacyValue'=>trim($v['emergency_contact_name'].($v['emergency_contact_number']?' - '.$v['emergency_contact_number']:''))]];
            if($onboarding){$next['address']=$address;$outcome='first';}
            elseif($changed){
                $id=bin2hex(random_bytes(16));$r=['kind'=>'staff','ownerUid'=>$actor,'ownerIdentifier'=>$a['identifier'],'ownerDisplayName'=>$a['displayName'],'requestedByUid'=>$actor,'requestedByName'=>$a['displayName'],'proposed'=>$address,'previousAddress'=>$p['address']['displayLine'],'reason'=>$v['reason'],'firstReferenceId'=>null,'status'=>'pending','reviewedAt'=>null,'reviewedByUid'=>null,'reviewedByName'=>'','reviewComment'=>'','legacyId'=>null];
                $writes[]=ac_write('staffRequests/'.$id,$r,false,['requestedAt']);$writes[]=ac_write('pendingRequests/'.$actor.'_staff',['ownerUid'=>$actor,'kind'=>'staff','requestId'=>$id]);$outcome='requested';
            }
            $writes[]=ac_write('staff/'.$actor,$next,true,['updatedAt']);$writes[]=ac_write('users/'.$actor,['profileCompleted'=>true],true,['updatedAt']);
        }
        return [$writes,['outcome'=>$outcome]];
    },true);
    if($action==='staffProfile')return $result;
    return ac_tx($actor,fn($tx,$a)=>[[],ac_result('',ac_staff_data($actor,$a,$tx),$result)],true);
}
