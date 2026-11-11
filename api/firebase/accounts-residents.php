<?php
/** Resident edits and address-aware status changes share a snapshot and retry key. */
function ac_resident_mutate(string $action,array $input,string $actor): array {
    $id=ss_id($input['resident_id']??'');
    return ac_once($actor,$input,function($tx,$a)use($action,$input,$id,$actor){
        ac_unlocked($id,$tx);$u=ss_read('users/'.$id,$tx);$p=ss_read('residents/'.$id,$tx);
        if(!$u||$u['role']!=='resident'||$u['deletedAt']!==null||!$p)api_error('Resident not found.');
        if($action==='updateResident'){
            $v=$input['values']??[];unset($v['resident_id']);$v['residency_status']=$p['residencyStatus'];
            [$next,$people]=ac_resident_values($v,$p);unset($next['lastResidencyRecordId']);
            return [[ac_write('residents/'.$id,$next,true,['updatedAt']),ac_write('users/'.$id,['displayName'=>ac_full($next)],true,['updatedAt']),...ac_people_writes('residents/'.$id,$people,$tx)],ac_result('Resident updated successfully.')];
        }
        if($action==='requestDeletion'){
            $reason=profile_strings($input,['reason'])['reason'];if(!$reason)api_error('Give a reason so the administrator can act on the request.');
            $pending=profile_query('','deletionRequests',['ownerUid'=>$id,'status'=>'pending'],$tx);
            if($pending)return [[],ac_result('A deletion request for this resident is already waiting for the administrator.')];
            $name=trim($p['name']['firstName'].' '.$p['name']['lastName']);$rid=bin2hex(random_bytes(16));
            $request=['kind'=>'deletion','ownerUid'=>$id,'ownerIdentifier'=>$u['identifier'],'ownerDisplayName'=>$name,'requestedByUid'=>$actor,'requestedByName'=>$a['displayName'],'reason'=>$reason,'proposed'=>['residentNumber'=>$u['identifier'],'residentName'=>$name],'previousAddress'=>'','firstReferenceId'=>null,'status'=>'pending','reviewedAt'=>null,'reviewedByUid'=>null,'reviewedByName'=>'','reviewComment'=>'','legacyId'=>null];
            return [[ac_write('deletionRequests/'.$rid,$request,false,['requestedAt'])],ac_result('Deletion request sent to the administrator for '.$name.'. The account is untouched until they decide.')];
        }
        ac_admin($a);$reason=profile_strings($input,['reason'])['reason'];$promotion=null;$writes=[];
        $logs=ss_query('','residencyRecords',$tx,['residentUid',$id]);usort($logs,fn($x,$y)=>strcmp($y['changedAt'],$x['changedAt'])?:strcmp($y['id'],$x['id']));
        foreach($logs as$l)if($l['toStatus']==='permanent'&&!$l['isReverted']){$promotion=$l;break;}
        $name=trim($p['name']['firstName'].' '.$p['name']['lastName']);
        if($action==='promote'){
            $duration=residency_duration(substr($p['residencyStartDate']??'',0,10));
            if($p['residencyStatus']!=='temporary')api_error('That resident is already permanent.');
            if(empty($p['temporaryAddress']['householdNumber'])&&empty($p['temporaryAddress']['displayLine']))api_error('This resident has no temporary address on file, so there is nothing to promote. Edit their record first.');
            if(!$duration)api_error('Set a valid "Residing Here Since" date on this resident before making them permanent.');
            if($duration['total_months']<permanent_residency_min_months())api_error('This resident has stayed only '.format_residency_duration($duration).'. They must reach '.permanent_residency_min_months().' months before being made permanent.');
            $next=['residencyStatus'=>'permanent','permanentAddress'=>$p['temporaryAddress'],'temporaryAddress'=>null,'residenceType'=>''];
            $message=$name.' is now a permanent resident. Their previous address is kept in Residency Records.';
        }else{
            if($p['residencyStatus']!=='permanent')api_error('That resident is already temporary.');
            if(!$reason)api_error('Give a reason before reverting someone to temporary. It is kept on the record.');
            $type=$promotion&&array_key_exists($promotion['previousResidenceType']??'',residence_types())?$promotion['previousResidenceType']:'';
            $next=['residencyStatus'=>'temporary','permanentAddress'=>$promotion?$promotion['previousPermanentAddress']:$p['permanentAddress'],'temporaryAddress'=>$p['permanentAddress'],'residenceType'=>$type];
            if($promotion)$writes[]=ac_write('residencyRecords/'.$promotion['id'],['isReverted'=>true],true);
            $message=$name.' has been returned to temporary resident status.'.(!$type?' Open their record and set the Type of Temporary Residence.':'').(!$promotion?' No archived address existed, so their address on file became the temporary one - enter their permanent address next.':'');
        }
        $logid=bin2hex(random_bytes(16));$log=['residentUid'=>$id,'fromStatus'=>$p['residencyStatus'],'toStatus'=>$next['residencyStatus'],'reason'=>$reason,'changedByUid'=>$actor,'changedByName'=>$a['displayName'],'previousPermanentAddress'=>$p['permanentAddress'],'previousTemporaryAddress'=>$p['temporaryAddress'],'previousResidenceType'=>$p['residenceType'],'isReverted'=>false,'legacyId'=>null];
        $next['lastResidencyRecordId']=$logid;
        return [[...$writes,ac_write('residencyRecords/'.$logid,$log,false,['changedAt']),ac_write('residents/'.$id,$next,true,['updatedAt'])],ac_result($message)];
    });
}
