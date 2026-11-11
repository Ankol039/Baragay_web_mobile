<?php
require_once __DIR__.'/../lib/request-lists.php';
require_once __DIR__.'/../lib/staff-profile.php';
function ac_fields(): array { return array_merge(api_profile_metadata(),['genders'=>gender_options(),'residence_types'=>residence_types(),'category_references'=>category_reference_fields(),'min_months'=>permanent_residency_min_months()]); }
function ac_full(array $p): string { return build_full_name(...array_map(fn($k)=>$p['name'][$k]??'', ['firstName','middleName','lastName','nameExtension'])); }
function ac_date_label($v): string { return $v ? date('M j, Y g:i A',strtotime($v)) : ''; }
function ac_request_row(array $r): array {
    return ['request_id'=>$r['id'],'name'=>!empty($r['proposed']['name']['firstName'])?trim($r['proposed']['name']['firstName'].' '.$r['proposed']['name']['lastName']):$r['ownerDisplayName'],'staff_name'=>$r['ownerDisplayName'],'staff_number'=>$r['ownerIdentifier'],
        'resident_number'=>$r['ownerIdentifier'],'resident_name'=>$r['ownerDisplayName'],'resident_id'=>$r['ownerUid'],
        'previous_address'=>$r['previousAddress']??'','address'=>$r['proposed']['permanentAddress']['displayLine']??$r['proposed']['displayLine']??'',
        'birthdate'=>substr($r['proposed']['birthdate']??'',0,10),'status'=>$r['status'],'reason'=>$r['reason']??'',
        'submitted_at'=>!empty($r['requestedAt'])?date('Y-m-d H:i:s',strtotime($r['requestedAt'])):'','requested_at'=>!empty($r['requestedAt'])?date('Y-m-d H:i:s',strtotime($r['requestedAt'])):'','requested_by_name'=>$r['requestedByName']??'',
        'reviewed_at'=>ac_date_label($r['reviewedAt']??null),'reviewed_by_name'=>$r['reviewedByName']??'','review_comment'=>$r['reviewComment']??''];
}
function ac_sorted_requests(string $collection,?string $tx=null): array {
    $rows=ss_query('',$collection,$tx);
    usort($rows,fn($a,$b)=>(($b['status']==='pending')<=>($a['status']==='pending')) ?: strcmp($b['requestedAt']??'',$a['requestedAt']??'') ?: strcmp($b['id'],$a['id']));
    return $rows;
}
function ac_detail(string $uid,array $u,?string $tx=null): array {
    $p=ss_read('residents/'.$uid,$tx);$h=$p['household'];
    $r=profile_unmap($p['name'],PROFILE_PERSON)+profile_unmap($p['permanentAddress'],PROFILE_ADDRESS);
    foreach(profile_unmap($p['temporaryAddress'],PROFILE_ADDRESS)as$k=>$v)$r['temp_'.$k]=$v;
    $r+=['resident_id'=>$uid,'resident_number'=>$u['identifier'],'email'=>$p['contact']['email'],'contact_number'=>$p['contact']['number'],'birthdate'=>substr($p['birthdate']??'',0,10),'birthplace'=>$p['birthplace'],'special_category'=>$p['specialCategory'],'category_reference'=>$p['categoryReference'],'residency_start_date'=>substr($p['residencyStartDate']??'',0,10),'address'=>$p['permanentAddress']['displayLine'],'temporary_address'=>$p['temporaryAddress']['displayLine']??'','residency_status'=>$p['residencyStatus'],'residence_type'=>$p['residenceType'],'occupation'=>$h['occupation'],'hotline_number'=>$h['hotlineNumber'],'is_married'=>$h['isMarried']?'1':'0','has_children'=>$h['hasChildren']?'1':'0'];
    foreach(['spouse','father','mother']as$who)foreach(profile_unmap($h[$who],PROFILE_PERSON)as$k=>$v)$r[$who.'_'.$k]=$v;
    foreach(['children'=>'children','references'=>'characterReferences']as$k=>$c){$rows=ss_query('residents/'.$uid,$c,$tx);usort($rows,fn($a,$b)=>$a['displayOrder']<=>$b['displayOrder']);$r[$k]=array_map(fn($x)=>profile_unmap($x['person'],PROFILE_PERSON),$rows);}
    return ['resident'=>$r];
}
function ac_read(string $action,array $input,string $actor): array {
    return ac_tx($actor,function($tx,$a)use($action,$input,$actor){
        $admin=$a['role']==='admin';
        if (in_array($action,['archives','residencyRecords'],true))ac_admin($a);
        if ($action==='resident') {
            $id=ss_id($input['id']??'');$u=ss_read('users/'.$id,$tx);
            if (!$u||$u['role']!=='resident'||$u['deletedAt']!==null)api_error('The selected resident could not be loaded.',404);
            $d=ac_detail($id,$u,$tx);$restore=null;
            if($admin){$logs=ss_query('','residencyRecords',$tx,['residentUid',$id]);usort($logs,fn($x,$y)=>strcmp($y['changedAt'],$x['changedAt']));foreach($logs as $l)if($l['toStatus']==='permanent'&&!$l['isReverted']){$restore=$l['previousPermanentAddress']['displayLine'];break;}}
            return [[],['resident'=>$d['resident'],'restore_address'=>$restore]];
        }
        if($action==='requests') {
            $resident=[];foreach(ac_sorted_requests('nameAddressRequests',$tx)as$r){$p=ss_read('residents/'.$r['ownerUid'],$tx);if(!$p)continue;$row=ac_request_row($r);$row['name']=trim(($r['proposed']['name']['firstName']??'').' '.($r['proposed']['name']['lastName']??''))?:trim($p['name']['firstName'].' '.$p['name']['lastName']);$resident[]=$row;}
            $staff=[];$family=[];
            if($admin){foreach(ac_sorted_requests('staffRequests',$tx)as$r)$staff[]=ac_request_row($r);
                foreach(ac_sorted_requests('familyRequests',$tx)as$r){if(!ss_read('users/'.$r['ownerUid'],$tx))continue;$p=ss_read('residents/'.$r['ownerUid'],$tx);if(!$p)continue;$row=ac_request_row($r);$row['name']=trim($p['name']['firstName'].' '.$p['name']['middleName'].' '.$p['name']['lastName']);$h=$r['proposed'];$payload=['occupation'=>$h['occupation'],'hotline_number'=>$h['hotlineNumber'],'is_married'=>$h['isMarried']];
                    foreach(['spouse','father','mother']as$who)foreach(profile_unmap($h[$who],PROFILE_PERSON)as$k=>$v)$payload[$who.'_'.$k]=$v;
                    foreach(['children'=>'children','references'=>'characterReferences']as$k=>$collection){$people=ss_query('familyRequests/'.$r['id'],$collection,$tx);usort($people,fn($x,$y)=>$x['displayOrder']<=>$y['displayOrder']);$payload[$k]=array_map(fn($p)=>profile_unmap($p['person'],PROFILE_PERSON),$people);}
                    $row['details']=api_request_family_details($payload);$row['requested_at']=ac_date_label($r['requestedAt']);$family[]=$row;}}
            return [[],['is_admin'=>$admin,'resident'=>$resident,'staff'=>$staff,'family'=>$family]];
        }
        if($action==='deletions'){ $rows=[];foreach(ac_sorted_requests('deletionRequests',$tx)as$r){$row=ac_request_row($r);$u=ss_read('users/'.$r['ownerUid'],$tx);$comment=$row['review_comment'];$row['was_restored']=str_contains($comment,'[Account later restored.]')||($u&&$u['deletedAt']===null&&$r['status']==='approved');$row['currently_deleted']=$u&&$u['deletedAt']!==null;$row['review_comment']=trim(str_replace('[Account later restored.]','',$comment));$rows[]=$row;}return [[],['is_admin'=>$admin,'requests'=>$rows]];}
        if($action==='residencyRecords'){$filter=in_array($input['filter']??'', ['permanent','temporary'],true)?$input['filter']:'';$rows=[];$p=0;$t=0;foreach(ss_query('','residencyRecords',$tx)as$l){$l['toStatus']==='permanent'?$p++:$t++;$u=ss_read('users/'.$l['residentUid'],$tx);$r=$u?ss_read('residents/'.$l['residentUid'],$tx):null;$rows[]=['change_id'=>$l['id'],'resident_id'=>$l['residentUid'],'from_status'=>$l['fromStatus'],'to_status'=>$l['toStatus'],'prev_address'=>$l['previousPermanentAddress']['displayLine']??'','prev_temporary_address'=>$l['previousTemporaryAddress']['displayLine']??'','reason'=>$l['reason'],'changed_at'=>ac_date_label($l['changedAt']),'is_reverted'=>(int)$l['isReverted'],'resident_number'=>$u['identifier']??null,'name'=>$r?trim($r['name']['firstName'].' '.$r['name']['lastName']):'Deleted resident #'.$l['residentUid'],'residency_status'=>$r['residencyStatus']??null,'changed_by_name'=>$l['changedByName']??(!empty($l['changedByUid'])?(ss_read('users/'.$l['changedByUid'],$tx)['displayName']??''):'')];}usort($rows,fn($x,$y)=>strtotime($y['changed_at'])<=>strtotime($x['changed_at']));if($filter)$rows=array_values(array_filter($rows,fn($r)=>$r['to_status']===$filter));return [[],['filter'=>$filter,'promotions'=>$p,'reversions'=>$t,'changes'=>$rows]];}
        $users=ss_query('','users',$tx);$residents=[];$staff=[];$pending=ss_query('','deletionRequests',$tx,['status','pending']);$pendingUids=array_column($pending,'ownerUid');
        foreach($users as$u){$deleted=$u['deletedAt']!==null;if(($action==='archives')!==$deleted)continue;$id=$u['uid'];$isResident=$u['role']==='resident';if(!$isResident&&!$admin)continue;$p=ss_read(($isResident?'residents/':'staff/').$id,$tx);if(!$p)continue;
            $name=$isResident?trim($p['name']['firstName'].' '.$p['name']['lastName']):$u['displayName'];
            $row=['full_name'=>$name,'name'=>with_courtesy_title($p['name']['courtesyTitle'],$name),'sortName'=>$p['name']['lastName'].' '.$p['name']['firstName'],'searchText'=>$u['identifier'].' '.$name,
                'is_active'=>$u['isActive'],'is_first_login'=>$u['isFirstLogin'],'deleted_at'=>ac_date_label($u['deletedAt']),'deleted_by_name'=>$u['deletedByName'],'delete_reason'=>$u['deleteReason']];
            if($isResident){$status=$p['residencyStatus']==='temporary'?'temporary':'permanent';$row+=['resident_id'=>$id,'resident_number'=>$u['identifier'],'residency_status'=>$status,'age'=>get_resident_age_label(substr($p['birthdate']??'',0,10)),'gender_label'=>gender_label($p['name']['gender']),'category_label'=>['none'=>'N/A','pwd'=>'PWD','senior_citizen'=>'Senior Citizen','pregnant'=>'Pregnant'][$p['specialCategory']]??'N/A','category_reference'=>$p['categoryReference'],'contact_number'=>$p['contact']['number'],'address'=>$p['permanentAddress']['displayLine'],'filter'=>$status.($u['isFirstLogin']?' pending-login':'').($u['isActive']?'':' deactivated'),'pending_delete'=>in_array($id,$pendingUids,true),'self_registered'=>$u['selfRegistered']??false];if($action==='archives')$row['response_count']=count(ss_query('','responses',$tx,['residentUid',$id]));$residents[]=$row;}
            else {$row+=['staff_id'=>$id,'staff_number'=>$u['identifier'],'username'=>$u['username'],'role'=>$u['role'],'date_hired'=>substr($p['dateHired']??'',0,10),'is_me'=>$id===$actor,'can_delete'=>$id!==$actor,'can_toggle'=>$id!==$actor,'can_reset'=>$id!==$actor,'display_name'=>with_courtesy_title($p['name']['courtesyTitle'],$name),'profile_completed'=>$u['profileCompleted']];$staff[]=$row;}}
        usort($residents,fn($x,$y)=>strcmp($action==='residents'?$x['resident_number']:$x['sortName'],$action==='residents'?$y['resident_number']:$y['sortName']));usort($staff,fn($x,$y)=>strcmp($y['role'],$x['role'])?:strcmp($x['full_name'],$y['full_name']));
        foreach($residents as&$r)unset($r['sortName']);unset($r);foreach($staff as&$s)unset($s['sortName']);unset($s);
        if($action==='archives'){usort($residents,fn($x,$y)=>strtotime($y['deleted_at'])<=>strtotime($x['deleted_at']));usort($staff,fn($x,$y)=>strtotime($y['deleted_at'])<=>strtotime($x['deleted_at']));}
        return [[],['residents'=>$residents,'staff'=>$staff,'can_delete'=>$admin,'is_admin'=>$admin,'pending_deletions'=>count($pending),'titles'=>courtesy_titles(),'today'=>date('Y-m-d'),'fields'=>ac_fields()]];
    });
}
