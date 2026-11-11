<?php
/** Selectively apply proposals; never replace fields absent from a correction. */
function ac_review(array $input,string $actor): array {
    $kind=$input['kind']??'';$collection=['resident'=>'nameAddressRequests','staff'=>'staffRequests','family'=>'familyRequests','deletion'=>'deletionRequests'][$kind]??null;
    if(!$collection)api_error('Invalid request.');
    $id=ss_id($input['request_id']??'');$decision=$input['decision']??'';if(!in_array($decision,['approve','reject'],true))api_error('Invalid review action.');
    // Deletion approval also changes Auth and must use the same recoverable lifecycle saga.
    if($kind==='deletion'&&$decision==='approve')return ac_lifecycle('approveDeletion',$input+['requestId'=>$id],$actor);
    return ac_once($actor,$input,function($tx,$a)use($input,$kind,$collection,$id,$decision,$actor){
        if(in_array($kind,['staff','deletion'],true)&&$a['role']!=='admin')api_error($kind==='staff'?'Only an administrator can review staff address changes.':'Only an administrator can approve or reject a deletion request.',403);
        $r=ss_read($collection.'/'.$id,$tx);$missing=['resident'=>'Request not found or already processed.','staff'=>'That staff request was not found, or it has already been reviewed.','family'=>'That request has already been decided.','deletion'=>'That request was not found, or it has already been reviewed.'];
        if(!$r||$r['status']!=='pending')api_error($missing[$kind]);$uid=$r['ownerUid'];ac_unlocked($uid,$tx);
        $u=ss_read('users/'.$uid,$tx);$path=($kind==='staff'?'staff/':'residents/').$uid;$p=ss_read($path,$tx);
        if(!$u||!$p)api_error('That request could not be applied. Nothing was changed.');
        $comment=profile_strings($input,['review_comment'])['review_comment'];if($decision==='reject'&&in_array($kind,['staff','deletion'],true)&&!$comment)api_error('Give a short reason when rejecting a request.');
        $writes=[];
        if($kind==='family'&&!is_array($r['proposed']??null))api_error('That request could not be read and was left pending.');
        if($decision==='approve'){
            $next=[];$v=$r['proposed'];
            if($kind==='resident'){
                foreach(['permanentAddress','temporaryAddress']as$key)if(!empty($v[$key]['householdNumber']))$next[$key]=$v[$key];
                if(!empty($v['name']['firstName'])||!empty($v['name']['lastName'])){$next['name']=$v['name'];$next['name']['gender']=$p['name']['gender'];$writes[]=ac_write('users/'.$uid,['displayName'=>ac_full($next)],true,['updatedAt']);}
                if(!empty($v['birthdate']))$next['birthdate']=new DateTimeImmutable($v['birthdate']);
            }elseif($kind==='staff')$next['address']=$v;
            elseif($kind==='family'){
                if(!is_array($v))api_error('That request could not be read and was left pending.');$next['household']=$v;$groups=[];
                foreach(['children','characterReferences']as$c){$rows=ss_query($collection.'/'.$id,$c,$tx);usort($rows,fn($x,$y)=>$x['displayOrder']<=>$y['displayOrder']);$groups[$c]=array_column($rows,'person');}
                $writes=[...$writes,...ac_people_writes($path,$groups,$tx)];
            }
            if($next)$writes[]=ac_write($path,$next,true,['updatedAt']);
        }
        $status=$decision==='approve'?'approved':'rejected';
        $writes[]=ac_write($collection.'/'.$id,['status'=>$status,'reviewedByUid'=>$actor,'reviewedByName'=>$a['displayName'],'reviewComment'=>$comment],true,['reviewedAt']);
        {$slot='pendingRequests/'.$uid.'_'.(['resident'=>'nameAddress','staff'=>'staff','family'=>'family','deletion'=>'deletion'][$kind]);$pointer=ss_read($slot,$tx);if(($pointer['requestId']??'')===$id)$writes[]=ss_delete($slot);}
        $message='Request has been '.$status.'.';if($kind==='staff')$message='Staff address request has been '.$status.'.';
        if($kind==='family')$message=$status==='approved'?"Family details updated from the resident's request.":'Family details request rejected. Nothing on the record changed.';
        if($kind==='deletion')$message='Request rejected. The record was left untouched.';
        return [$writes,ac_result($message,[],['ui'=>['show_success'=>$kind!=='family']])];
    });
}
