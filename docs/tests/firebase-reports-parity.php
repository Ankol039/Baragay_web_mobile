<?php
/** Database-free execution of the unchanged original results/report/CSV loaders against synthetic rows. */
require_once __DIR__.'/../../api/firebase/report-store.php';
require_once __DIR__.'/../../api/firebase/report-stats.php';
require_once __DIR__.'/../../api/firebase/report-results.php';
require_once __DIR__.'/../../api/firebase/report-dashboard.php';
date_default_timezone_set('Asia/Manila');
error_reporting(E_ALL & ~E_DEPRECATED);
$checks=0;
function same($a,$b,string $label):void { global $checks; if($a!==$b) throw new RuntimeException($label."\n".var_export([$a,$b],true)); $checks++; }
class ReportReferenceRows {
    private int $index=0;
    public function __construct(private array $rows) {}
    public function fetch_assoc() { return $this->rows[$this->index++]??null; }
    public function fetch_all($mode=0):array { return $this->rows; }
}
class ReportReferenceStatement {
    private $param; private array $rows=[];
    public function __construct(private string $sql,private ReportReferenceConnection $db) {}
    public function bind_param($types,&$param):void { $this->param=&$param; }
    public function close():void {}
    public function execute():void { $this->rows=$this->db->prepared($this->sql,$this->param); }
    public function get_result():ReportReferenceRows { return new ReportReferenceRows($this->rows); }
}
class ReportReferenceConnection {
    public function __construct(public array $survey,public array $questions,public array $choices,public array $answers) {}
    public function query(string $sql):ReportReferenceRows {
        if(str_contains($sql,'survey_questions')) return new ReportReferenceRows($this->questions);
        return new ReportReferenceRows([['survey_id'=>7,'title'=>$this->survey['title']]]);
    }
    public function prepare(string $sql):ReportReferenceStatement { return new ReportReferenceStatement($sql,$this); }
    public function prepared(string $sql,$qid):array {
        if(str_contains($sql,'COUNT(*) c FROM responses')) return [['c'=>3]];
        if(str_contains($sql,'FROM surveys')) return [$this->survey];
        $answers=array_values(array_filter($this->answers,fn($a)=>$a['questionId']===(string)$qid));
        if(str_contains($sql,'survey_choices')) {
            $result=[];
            foreach($this->choices[(string)$qid]??[] as $c) $result[]=['choice_text'=>$c['text'],'votes'=>count(array_filter($answers,fn($a)=>($a['choiceId']??null)===$c['id']))];
            return $result;
        }
        if(str_contains($sql,'AVG(rating_value)')) {
            $values=array_values(array_filter(array_column($answers,'rating'),fn($v)=>$v!==null));
            return [['avg_rating'=>$values?array_sum($values)/count($values):null,'n'=>count($values)]];
        }
        if(str_contains($sql,'rating_value')) {
            $counts=array_count_values(array_filter(array_column($answers,'rating'),fn($v)=>$v!==null)); ksort($counts);
            if(str_contains($sql,'UNION ALL')) return array_map(fn($n)=>['choice_text'=>$n.' star(s)','votes'=>$counts[$n]??0],range(1,5));
            $rows=[];foreach($counts as $n=>$votes)$rows[]=['rating_value'=>$n,'votes'=>$votes];return $rows;
        }
        if(str_contains($sql,"IN ('Yes','No')")||str_contains($sql,"SELECT 'Yes'")) {
            $rows=[];$force=str_contains($sql,"SELECT 'Yes'");
            foreach($force?['Yes','No']:['No','Yes'] as $text) { $n=count(array_filter($answers,fn($a)=>($a['text']??'')===$text));if($force||$n)$rows[]=$force?['choice_text'=>$text,'votes'=>$n]:['answer_text'=>$text,'votes'=>$n]; }
            return $rows;
        }
        $answers=array_values(array_filter($answers,fn($a)=>($a['text']??'')!==''));
        usort($answers,fn($a,$b)=>($a['legacyId']<=>$b['legacyId'])*(str_contains($sql,'DESC')?-1:1));
        if(str_contains($sql,'LIMIT 200'))$answers=array_slice($answers,0,200);
        return array_map(fn($a)=>['answer_text'=>$a['text']]+(str_contains($sql,'submitted_at')?['submitted_at'=>$a['submitted_at']]:[]),$answers);
    }
}
function original(string $file,ReportReferenceConnection $conn):array {
    $_GET['survey_id']=7;
    $source=file_get_contents(__DIR__.'/../../staff/'.$file);
    if($file==='export_csv.php') {
        $source=substr($source,strpos($source,'$survey_id ='));
        $source=preg_replace('/^header\([^\n]+\);\n/m','',$source);
        $source=str_replace(["fopen('php://output', 'w')",'fclose($out);','exit;'],["fopen('php://temp', 'w+')",'rewind($out); $csv=stream_get_contents($out); fclose($out);',''],$source);
        eval($source); return ['filename'=>$filename,'csv'=>$csv];
    }
    $source=substr($source,strpos($source,'$surveys ='));
    $source=substr($source,0,strpos($source,"require_once '../includes/header_staff.php'"));
    eval($source); return ['questions'=>$questions,'total_respondents'=>(int)$total_respondents];
}
$survey=['survey_id'=>7,'title'=>'Health, "survey"','description'=>'Synthetic','start_date'=>'2026-01-01','end_date'=>'2026-01-31','status'=>'inactive','created_by_name'=>'Fixture Staff'];
$questions=[];foreach(['multiple_choice','yesno','rating','short_answer'] as $i=>$type)$questions[]=['question_id'=>(string)($i+1),'question_text'=>'Question '.$type,'question_type'=>$type,'question_order'=>$i+1];
$choices=['1'=>[['id'=>'10','text'=>'A, choice'],['id'=>'11','text'=>'B']]];
$answers=[];
foreach([['1','10','',null],['1','10','',null],['1','deleted','',null],['2',null,'Yes',null],['3',null,'',1],['3',null,'',5],['3',null,'',5],['4',null,"line one\nline two",null],['4',null,'"quote", comma',null],['4',null,'',null]] as $i=>$a)
    $answers[]=['questionId'=>$a[0],'choiceId'=>$a[1],'text'=>$a[2],'rating'=>$a[3],'legacyId'=>$i+1,'submitted_at'=>'2026-01-01T16:30:00Z','response_id'=>'r'.$i];
foreach(['populated'=>$answers,'empty'=>[]] as $case=>$fixture) {
    $db=new ReportReferenceConnection($survey,$questions,$choices,$fixture);
    foreach(['results'=>'results_dashboard.php','report'=>'reports.php','csv'=>'export_csv.php'] as $mode=>$file) {
        $reference=original($file,$db);$output=[];
        foreach($questions as $q) {
            $value=rp_question_result(['id'=>$q['question_id'],'text'=>$q['question_text'],'type'=>$q['question_type'],'order'=>$q['question_order']],$choices[$q['question_id']]??[],$fixture,$mode);
            $output[]=$value;
            if($mode==='csv')continue;
            $expected=$reference['questions'][count($output)-1];
            if($mode==='report') {
                same(array_map(fn($r)=>array_intersect_key($r,array_flip(['choice_text','votes','answer_text'])),$value['rows']),$expected['rows'],"$case report rows {$q['question_type']}");
                same($value['answered_here'],$q['question_type']==='short_answer'?count($expected['rows']):array_sum(array_column($expected['rows'],'votes')),"$case report denominator");
            } elseif($q['question_type']==='short_answer') {
                same(array_map(fn($a)=>array_intersect_key($a,array_flip(['answer_text','submitted_at'])),$value['answers']),$expected['answers'],"$case source answer order/filter");
            } else {
                same(array_map(fn($r)=>array_diff_key($r,array_flip(['percent','winning'])),$value['breakdown']),$expected['breakdown'],"$case source counts/zero rows");
                same($value['total_votes'],array_sum(array_column($expected['breakdown'],'votes')),"$case vote denominator");
                if($q['question_type']==='rating')same((float)$value['avg_rating'],(float)$expected['avg_rating'],"$case rating average rounding");
            }
        }
        if($mode==='csv')same(rp_csv(['survey'=>$survey,'questions'=>$output])['data'],$reference,"$case original CSV bytes and filename");
    }
}
same(rp_label('2026-01-01T16:30:00Z',true),'Jan 2, 2026 12:30 AM','Manila submission display');
same(rp_trend([['submittedAt'=>'2026-01-01T16:30:00Z']],['from'=>'2026-01-03','to'=>'2026-01-01']),[['label'=>'Jan 1','value'=>0],['label'=>'Jan 2','value'=>1],['label'=>'Jan 3','value'=>0]],'Swapped trend window and Manila midnight');
same(count(rp_trend([],['from'=>'2020-01-01','to'=>'2026-01-01'])),366,'Original inclusive 365-day clamp');
same(count(rp_trend([],['from'=>'invalid','to'=>'2026-01-01'])),30,'Invalid date fallback');
same(api_staff_delta(1,0),['up','+1 new'],'Zero prior delta');
same(api_staff_delta(1,3),['down','-67%'],'PHP delta rounding');
same(rp_compare('ÁBC','abc'),0,'MySQL case/accent-insensitive comparison');
same(rp_csv(['survey'=>null])['redirect'],'/staff/reports','Deleted survey export destination');
require_once __DIR__.'/../../api/firebase/report-views.php';
$originalViews=file_get_contents(__DIR__.'/../../staff/stat_detail.php');
$originalViews=substr($originalViews,strpos($originalViews,'$views ='));
$originalViews=substr($originalViews,0,strpos($originalViews,'// Whitelist check'));
eval($originalViews);
foreach(REPORT_VIEWS as $key=>$metadata) same($metadata,array_diff_key($views[$key],array_flip(['sql','row'])),"Original $key labels/columns");
$fixture=[];for($i=1;$i<=205;$i++)$fixture[]=['questionId'=>'4','text'=>'answer '.$i,'legacyId'=>$i,'submitted_at'=>'2026-01-01T00:00:00Z','response_id'=>'r'.$i];
$q=['id'=>'4','text'=>'Long answers','type'=>'short_answer','order'=>1];
$limited=rp_question_result($q,[],$fixture,'results');same(count($limited['answers']),200,'Original text cap');same($limited['answers'][0]['answer_text'],'answer 205','Newest imported answer first');
same(count(rp_question_result($q,[],$fixture,'report')['rows']),205,'Print is uncapped');
$invalid=rp_question_result(['id'=>'2','text'=>'Yes?','type'=>'yesno','order'=>1],[],[['questionId'=>'2','text'=>'Maybe']],'results');same($invalid['total_votes'],0,'Invalid yes/no excluded');
$ties=rp_question_result(['id'=>'1','text'=>'Pick','type'=>'multiple_choice','order'=>1],$choices['1'],[['questionId'=>'1','choiceId'=>'10'],['questionId'=>'1','choiceId'=>'11']],'results');same(array_column($ties['breakdown'],'winning'),[true,true],'Tied winning choices');same(array_column($ties['breakdown'],'percent'),[50,50],'Rounded percent');
$emptyStats=rp_stats([],[],[],[],[]);
same($emptyStats['age_groups'],array_map(fn($label)=>['label'=>$label,'value'=>0],['Under 18','18 - 34','35 - 59','60 and over']),'Empty age bands retained');
same(array_column($emptyStats['household'],'value'),[0,0,0,0],'Empty household bars');
same($emptyStats['gender_mix'],[],'Empty genders');
same($emptyStats['responses_per_survey'],[],'Empty survey chart');
$person=['deleted_at'=>null,'birthdate'=>'2000-01-01','residency_status'=>'permanent','gender'=>'woman','special_category'=>'pwd','occupation'=>' Nurse ','purok'=>'Purok 1','is_married'=>true,'has_children'=>false];
$demographic=rp_stats([],[],[$person,$person+[],array_replace($person,['deleted_at'=>'2026-01-01','occupation'=>'Deleted']),array_replace($person,['occupation'=>'nurse','gender'=>'','birthdate'=>'1960-01-01','residency_status'=>'temporary','special_category'=>'','is_married'=>false,'has_children'=>true,'purok'=>'purok 1']),array_replace($person,['occupation'=>'N/A','purok'=>''])],[],[]);
same($demographic['occupations'],[['label'=>'Nurse','value'=>3]],'Occupation SQL grouping, trimming, exclusions and deleted filter');
same($demographic['purok_mix'],[['label'=>'Purok 1','value'=>3]],'Purok SQL grouping and empty exclusion');
same($demographic['gender_mix'],[['label'=>gender_options()['woman'],'value'=>3],['label'=>'Not recorded','value'=>1]],'Gender labels/order and unstated');
same($demographic['priority_groups'],[['label'=>'PWD','value'=>3],['label'=>'No priority group','value'=>1]],'Priority order/default');
same(array_column($demographic['residency_mix'],'value'),[3,1],'Residency demographic count');
same(array_column($demographic['household'],'value'),[3,1,1,3],'Household source denominators');
same(rp_trend([],['from'=>['invalid'],'to'=>'2026-01-01']),rp_trend([],['to'=>'2026-01-01']),'Non-string date input fallback');
echo "PASS: $checks database-free source-parity checks\n";
