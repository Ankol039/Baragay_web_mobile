<?php
require_once __DIR__ . '/report-views.php';
function rp_detail(string $key,array $surveys,array $responses,array $residents,array $users): array {
    $counts=array_count_values(array_column($responses,'surveyId')); $rows=[];
    if(in_array($key,['total_surveys','active_surveys'],true)) {
        $rows=array_values(array_filter($surveys,fn($s)=>$key==='total_surveys'||rp_open($s)));
        $rows=array_map(fn($s)=>$s+['response_count'=>$counts[$s['survey_id']]??0,'days_left'=>(int)((strtotime($s['end_date'])-strtotime('today'))/86400)],$rows);
        if($key==='active_surveys') $rows=rp_sort($rows,fn($a,$b)=>strcmp($a['end_date'],$b['end_date']));
    } elseif(in_array($key,['total_residents','deactivated_residents'],true)) {
        $rows=array_values(array_filter($residents,fn($r)=>$r['deleted_at']===null&&($key==='total_residents'||!$r['is_active'])));
        $rows=rp_sort($rows,fn($a,$b)=>rp_compare($a['last_name'],$b['last_name']) ?: ($key==='total_residents'?rp_compare($a['first_name'],$b['first_name']):0));
    } elseif($key==='total_responses') {
        $ordered=rp_sort($responses,fn($a,$b)=>strcmp($b['submittedAt'],$a['submittedAt']));
        foreach($ordered as $r) if(isset($surveys[$r['surveyId']])) {
            $p=$residents[$r['residentUid']]??null;
            $rows[]=['title'=>$surveys[$r['surveyId']]['title'],'submitted_at'=>$r['submittedAt'],'resident_name'=>$p?$p['first_name'].' '.$p['last_name']:null];
            if(count($rows)===200) break;
        }
    } elseif(in_array($key,['staff_accounts','deactivated_staff'],true)) {
        foreach($users as $u) if(in_array($u['role'],['staff','admin'],true)&&($u['deletedAt']??null)===null&&($key==='staff_accounts'||!$u['isActive']))
            $rows[]=['full_name'=>$u['displayName'],'username'=>$u['username'],'role'=>$u['role'],'is_active'=>(int)$u['isActive'],'created_at'=>$u['createdAt']];
        $rows=rp_sort($rows,fn($a,$b)=>($key==='staff_accounts'?strcmp($a['role'],$b['role']):0) ?: rp_compare($a['full_name'],$b['full_name']));
    } elseif($key==='recent_logins') {
        // Original drilldown has no event predicate and no stored role selection.
        $rows=rp_activity($users,$residents,'',false);
    }
    foreach($rows as &$r) {
        foreach(['start_date','end_date','created_at','submitted_at','login_time'] as $f) if(isset($r[$f])) $r[$f.'_label']=rp_label($r[$f],in_array($f,['submitted_at','login_time'],true));
        $r=array_intersect_key($r,array_flip(['survey_id','title','start_date','end_date','status','response_count','days_left','resident_number','first_name','last_name','contact_number','residency_status','is_active','resident_name','submitted_at','full_name','username','role','created_at','person','type_label','login_time','start_date_label','end_date_label','created_at_label','submitted_at_label','login_time_label']));
    }
    unset($r);
    return REPORT_VIEWS[$key]+['view'=>$key,'rows'=>$rows,'count'=>count($rows)];
}
