<?php
/** Verified, read-only Firebase staff/admin reports. */
ini_set('display_errors','0');
require_once __DIR__.'/transport.php';
set_exception_handler(function(Throwable $error):void {
    if ($error instanceof FirebaseBoundaryError) fb_fail($error->getMessage(), $error->getCode());
    fb_fail('The system is temporarily unavailable. Please try again in a few minutes.',503);
});
require_once __DIR__.'/auth.php';
require_once __DIR__.'/report-store.php';
require_once __DIR__.'/report-dashboard.php';
require_once __DIR__.'/report-stats.php';
require_once __DIR__.'/report-detail.php';
require_once __DIR__.'/report-results.php';
date_default_timezone_set('Asia/Manila');
if($_SERVER['REQUEST_METHOD']!=='POST') fb_fail('Method not allowed.',405);
if(strtolower(explode(';',$_SERVER['CONTENT_TYPE']??'')[0])!=='application/json') fb_fail('Unsupported request content type.',415);
if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site') fb_fail('Access denied.',403);
if((int)($_SERVER['CONTENT_LENGTH']??0)>16384) fb_fail('Invalid request.',413);
$raw=file_get_contents('php://input',false,null,0,16385);
if(strlen($raw)>16384) fb_fail('Invalid request.',413);
if(!is_object(json_decode($raw))) fb_fail('Invalid JSON request.',400);
$input=json_decode($raw,true);
if(!is_string($input['idToken']??null)||!is_string($input['action']??null)) fb_fail('Invalid request.',400);
[$identity,$account]=fb_verified($input); rp_worker($account);
$action=$input['action'];
if(!in_array($action,['dashboard','trend','detail','results','report','csv'],true)) fb_fail('Not found.',404);
$key=$input['view']??'';
if($action==='detail'&&(!is_string($key)||!isset(REPORT_VIEWS[$key])||(REPORT_VIEWS[$key]['admin']&&$account['role']!=='admin')))
    fb_reply(['ok'=>true,'data'=>null,'redirect'=>'/staff/dashboard']);
$sid=$input['survey_id']??'0';
if(!is_string($sid)&&!is_int($sid)) fb_fail('Invalid request.',400);
$sid=(string)$sid;
if($sid!==''&&!preg_match('/\A[A-Za-z0-9_-]{1,128}\z/',$sid)) fb_fail('Invalid request.',400);
$c=fb_config();
[$status,$begin]=fb_http($c['documents'].':beginTransaction',['options'=>['readOnly'=>(object)[]]],$c['access']);
if($status!==200) throw new RuntimeException('Report snapshot unavailable');
$report_transaction=$begin['transaction'];
try {
    [$status,$worker]=fb_http($c['documents'].':batchGet',['documents'=>[fb_name('users/'.$identity['localId'])],'transaction'=>$report_transaction],$c['access']);
    if($status!==200) throw new RuntimeException('Authorization snapshot unavailable');
    $current=isset($worker[0]['found'])?array_map('fb_decode',$worker[0]['found']['fields']??[]):null; rp_worker($current);
    if($action==='detail'&&REPORT_VIEWS[$key]['admin']&&$current['role']!=='admin') $result=['ok'=>true,'data'=>null,'redirect'=>'/staff/dashboard'];
    elseif($action==='trend') $result=['ok'=>true,'data'=>['response_trend'=>rp_trend(rp_responses(),$input)]];
    elseif(in_array($action,['results','report','csv'],true)) {
        $data=rp_results($sid,$action,rp_surveys()); $result=$action==='csv'?rp_csv($data):['ok'=>true,'data'=>$data];
    } else {
        // Drilldowns read only their source tables; the dashboard shares its projected snapshot with charts.
        $surveys=$action==='dashboard'||in_array($key,['total_surveys','active_surveys','total_responses'],true)?rp_surveys():[];
        $responses=$action==='dashboard'||in_array($key,['total_surveys','active_surveys','total_responses'],true)?rp_responses():[];
        $needPeople=$action==='dashboard'||in_array($key,['total_residents','deactivated_residents','total_responses','recent_logins','staff_accounts','deactivated_staff'],true);
        $users=$needPeople?rp_users():[];
        $residents=$needPeople&&!in_array($key,['staff_accounts','deactivated_staff'],true)?rp_residents($users):[];
        if($action==='detail') $data=rp_detail($key,$surveys,$responses,$residents,$users);
        else {
            $data=rp_dashboard($surveys,$responses,$residents,$users,$current['role']==='admin');
            $data['charts']=rp_stats($surveys,$responses,$residents,rp_query('questions',['type'],'',[],0,'',true),$input);
        }
        $result=['ok'=>true,'data'=>$data];
    }
} finally { fb_http($c['documents'].':rollback',['transaction'=>$report_transaction],$c['access']); }
fb_reply($result);
