<?php
/** Auth/Firestore cannot transact together. Close access and lock first; resume by UUID. */
function ac_lifecycle(string $action,array $input,string $actor): array {
    $opid=ac_operation($input);$path='accountOperations/'.hash('sha256',$actor.':'.$opid);
    $binding=$input;unset($binding['idToken']);$fingerprint=hash('sha256',json_encode([$action,$binding]));
    $op=ac_tx($actor,function($tx,$a)use($input,$action,$path,$fingerprint,$actor){
        $old=ss_read($path,$tx);if($old){if(($old['fingerprint']??'')!==$fingerprint)api_error('Invalid request.');return [[], $old];}
        $admin=$a['role']==='admin';$rid=$input['requestId']??null;$request=$rid?ss_read('deletionRequests/'.ss_id($rid),$tx):null;
        if($action==='approveDeletion'&&(!$request||$request['status']!=='pending'))api_error('That request was not found, or it has already been reviewed.');
        $id=ss_id($request?$request['ownerUid']:($input['targetUid']??$input['id']??''));ac_unlocked($id,$tx);$u=ss_read('users/'.$id,$tx);
        $staff=($input['kind']??'')==='staff';if($request)$staff=false;
        if(($staff||in_array($action,['archive','restore','purge','approveDeletion'],true))&&!$admin){
            $denial=$action==='approveDeletion'?'Only an administrator can approve or reject a deletion request.':($staff?($action==='toggle'?'Only administrators can deactivate staff accounts.':'Only administrators can delete a staff account.'):($action==='archive'?'Only an administrator can delete a resident record. Use Request Deletion instead, or deactivate the account to block access without losing their survey history.':'Access denied.'));api_error($denial,403);
        }
        if($id===$actor&&$staff)api_error(['toggle'=>'You cannot deactivate your own account while logged in.','archive'=>'You cannot delete the account you are signed in with.','purge'=>'You cannot permanently delete the account you are signed in with.'][$action]??'Access denied.');
        if(!$u||(($u['role']!=='resident')!==$staff)){
            if(in_array($action,['restore','purge'],true)){$empty=['fingerprint'=>$fingerprint,'state'=>'complete','result'=>ac_result($action==='restore'?'That account was not found in the archive, or it has already been restored.':'That account was not found in the archive.')];return [[ac_write($path,$empty,false,['createdAt','updatedAt'])],$empty];}
            api_error($staff?'That staff account could not be found.':'Resident could not be found.');
        }
        $deleted=$u['deletedAt']!==null;
        if(in_array($action,['restore','purge'],true)&&!$deleted){$empty=['fingerprint'=>$fingerprint,'state'=>'complete','result'=>ac_result($action==='restore'?'That account was not found in the archive, or it has already been restored.':'That account was not found in the archive.')];return [[ac_write($path,$empty,false,['createdAt','updatedAt'])],$empty];}
        if(!in_array($action,['restore','purge'],true)&&$deleted)api_error($staff?'That staff account could not be found.':'Resident could not be found.');
        if($staff&&$u['role']==='admin'&&($action==='archive'||($action==='toggle'&&$u['isActive']))){
            $others=array_filter(ss_query('','users',$tx,['role','admin']),fn($x)=>$x['uid']!==$id&&$x['isActive']&&$x['deletedAt']===null);
            if(!$others)api_error('This is the only administrator account left. Promote or create another administrator before deleting this one.');
        }
        // Refuse an oversized final review/update before reserving a target lock.
        if($u['role']==='resident'&&in_array($action,['archive','approveDeletion','restore'],true)&&count(ss_query('','deletionRequests',$tx,['ownerUid',$id]))>490)api_error('The request could not be completed. Please try again.');
        if($action==='restore'&&$u['role']==='resident')foreach(ss_query('','deletionRequests',$tx,['ownerUid',$id])as$r)if($r['status']==='approved'&&!str_contains($r['reviewComment'],'[Account later restored.]'))ac_bounds(['reviewComment'=>trim($r['reviewComment'].' [Account later restored.]')]);
        $active=$action==='toggle'?!$u['isActive']:$u['isActive'];$next=['isActive'=>$active];$message='';
        if($action==='toggle')$message=$staff?($active?'Staff account reactivated.':'Staff account deactivated.'):($active?'Resident account reactivated.':(($input['source']??'')==='users'?'Resident account deactivated.':'Resident account deactivated. Their survey history has been kept.'));
        if(in_array($action,['archive','approveDeletion'],true)){
            $next+=['deletedAt'=>new DateTimeImmutable('now',new DateTimeZone('UTC')),'deletedByUid'=>$actor,'deletedByName'=>$a['displayName'],'deleteReason'=>$action==='approveDeletion'?'Deletion request approved: '.$request['ownerDisplayName']:($staff?'Deleted from User Management.':'Deleted from the Residents page.')];
            $message=$action==='approveDeletion'?'Request approved. '.$request['ownerDisplayName'].' was moved to Deleted Accounts and can be restored from there.':($staff?$u['displayName'].' was moved to Deleted Accounts. You can restore the account from there.':'Resident moved to Deleted Accounts. Their survey responses were kept, and you can restore the account from there.');
        }
        if($action==='restore'){$next+=['deletedAt'=>null,'deletedByUid'=>null,'deletedByName'=>'','deleteReason'=>''];$message='Account restored. It can sign in again and its records are back in the lists.';}
        if($action==='purge')$message='Account permanently deleted. This one cannot be undone.';
        // Store timestamp values in the operation as timestamps, rather than JSON strings.
        $op=['fingerprint'=>$fingerprint,'state'=>'pending','targetUid'=>$id,'kind'=>$staff?'staff':'resident','action'=>$action,'next'=>$next,'requestId'=>$rid,'reviewComment'=>profile_strings($input,['review_comment'])['review_comment'],'actorName'=>$a['displayName'],'result'=>ac_result($message)];
        return [[ac_write($path,$op,false,['createdAt','updatedAt']),ac_write('accountLocks/'.$id,['operationPath'=>$path]),ac_write('users/'.$id,['isActive'=>false],true,['updatedAt'])],$op];
    });
    if($op['state']==='complete')return $op['result'];$id=$op['targetUid'];
    if($action==='purge')return ac_purge($op,$path,$actor);
    $disabled=empty($op['next']['isActive'])||($op['next']['deletedAt']??null)!==null;
    [$status]=ac_auth('update',['localId'=>$id,'disableUser'=>$disabled,'validSince'=>(string)time()]);
    if($status!==200)throw new RuntimeException('Account status unavailable');
    return ac_tx($actor,function($tx,$a)use($op,$path,$id,$actor){
        $fresh=ss_read($path,$tx);if($fresh['state']==='complete')return [[], $fresh['result']];
        if(($op['kind']==='staff')||$op['action']!=='toggle')ac_admin($a);
        $lock=ss_read('accountLocks/'.$id,$tx);if(($lock['operationPath']??'')!==$path)api_error('The request could not be completed. Please try again.',409);
        $next=$op['next'];if(!empty($next['deletedAt'])&&is_string($next['deletedAt']))$next['deletedAt']=new DateTimeImmutable($next['deletedAt']);
        $writes=[ac_write('users/'.$id,$next,true,['updatedAt']),ac_write($path,['state'=>'complete'],true,['updatedAt']),ss_delete('accountLocks/'.$id)];
        if($op['kind']==='resident')foreach(ss_query('','deletionRequests',$tx,['ownerUid',$id])as$r){
            if(in_array($op['action'],['archive','approveDeletion'],true)&&$r['status']==='pending')$writes[]=ac_write('deletionRequests/'.$r['id'],['status'=>'approved','reviewedByUid'=>$actor,'reviewedByName'=>$a['displayName'],'reviewComment'=>$r['id']===$op['requestId']?$op['reviewComment']:($op['action']==='archive'?'Deleted directly by an administrator.':'Resolved by another request for the same resident.')],true,['reviewedAt']);
            if($op['action']==='restore'&&$r['status']==='approved'&&!str_contains($r['reviewComment'],'[Account later restored.]'))$writes[]=ac_write('deletionRequests/'.$r['id'],['reviewComment'=>trim($r['reviewComment'].' [Account later restored.]')],true);
        }
        if($op['kind']==='resident'&&in_array($op['action'],['archive','approveDeletion'],true)){
            $slot='pendingRequests/'.$id.'_deletion';if(ss_read($slot,$tx))$writes[]=ss_delete($slot);
        }
        return [$writes,$op['result']];
    });
}
