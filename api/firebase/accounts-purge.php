<?php
/** Bounded, restartable leaf-first purge. Archive and account lock remain until Auth is gone. */
function ac_purge(array $op,string $path,string $actor): array {
    $id=$op['targetUid'];
    [$status,$body]=ac_auth('update',['localId'=>$id,'disableUser'=>true,'validSince'=>(string)time()]);
    if($status!==200&&($body['error']['message']??'')!=='USER_NOT_FOUND')throw new RuntimeException('Account disable unavailable');
    for($round=0;$round<200;$round++){
        $done=ac_tx($actor,function($tx,$a)use($id,$path,$op){
            ac_admin($a);$fresh=ss_read($path,$tx);if($fresh['state']==='complete')return [[],true];
            if((ss_read('accountLocks/'.$id,$tx)['operationPath']??'')!==$path)api_error('The request could not be completed. Please try again.',409);
            $writes=[];$parent=($op['kind']==='resident'?'residents/':'staff/').$id;
            if($op['kind']==='resident'){
                foreach(['children','characterReferences']as$c)foreach(ss_query($parent,$c,$tx,[],350)as$r)$writes[]=ss_delete($parent.'/'.$c.'/'.$r['id']);
                foreach(ss_query('','responses',$tx,['residentUid',$id],100)as$r){$answers=ss_query('responses/'.$r['id'],'answers',$tx,[],350);foreach($answers as$ans)$writes[]=ss_delete('responses/'.$r['id'].'/answers/'.$ans['id']);if(count($answers)<350)$writes[]=ss_delete('responses/'.$r['id']);if(count($writes)>=350)break;}
                // Original name/address, deletion and residency logs survive their owner; family rows cascade.
                foreach(ss_query('','familyRequests',$tx,['ownerUid',$id],50)as$r){$leaves=[];foreach(['children','characterReferences']as$c)foreach(ss_query('familyRequests/'.$r['id'],$c,$tx,[],350)as$person)$leaves[]=ss_delete('familyRequests/'.$r['id'].'/'.$c.'/'.$person['id']);$writes=[...$writes,...$leaves];if(!$leaves)$writes[]=ss_delete('familyRequests/'.$r['id']);if(count($writes)>=350)break;}
            }
            foreach(ss_query('','identifierAliases',$tx,['uid',$id],350)as$r)$writes[]=ss_delete('identifierAliases/'.$r['id']);
            if($writes)return [array_slice($writes,0,350),false];
            return [[],true];
        });
        if($done)break;
    }
    if(!$done)api_error('The request could not be completed. Please try again.',409);
    [$status,$body]=ac_auth('delete',['localId'=>$id]);if($status!==200&&($body['error']['message']??'')!=='USER_NOT_FOUND')throw new RuntimeException('Account removal unavailable');
    return ac_tx($actor,function($tx,$a)use($id,$path,$op){
        ac_admin($a);$fresh=ss_read($path,$tx);if($fresh['state']==='complete')return [[], $fresh['result']];
        if((ss_read('accountLocks/'.$id,$tx)['operationPath']??'')!==$path)api_error('The request could not be completed. Please try again.',409);
        $writes=[];foreach(['users','residents','staff','profileImages','accountLocks']as$c)$writes[]=ss_delete($c.'/'.$id);
        foreach(['nameAddress','family','staff','deletion']as$kind)$writes[]=ss_delete('pendingRequests/'.$id.'_'.$kind);
        $writes[]=ac_write($path,['state'=>'complete'],true,['updatedAt']);return [$writes,$op['result']];
    });
}
