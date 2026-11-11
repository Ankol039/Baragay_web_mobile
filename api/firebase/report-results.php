<?php
/** Results, print, CSV preserve the different zero-row and answer-order policies in the originals. */
function rp_answers(array $responses): array {
    $answers=[];
    foreach($responses as $r) foreach(rp_query('answers',['questionId','choiceId','text','rating','legacyId'],'responses/'.$r['id']) as $a)
        $answers[]=$a+['submitted_at'=>$r['submittedAt'],'response_id'=>$r['id']];
    return $answers;
}
function rp_question_result(array $q,array $choices,array $answers,string $mode): array {
    $qid=$q['id']; $type=$q['type'];
    $own=array_values(array_filter($answers,fn($a)=>$a['questionId']===$qid));
    $row=['question_id'=>$qid,'question_text'=>$q['text'],'question_type'=>$type,'question_order'=>$q['order']];
    $rows=[];
    if($type==='multiple_choice') {
        foreach($choices as $c) $rows[]=['choice_text'=>$c['text'],'votes'=>count(array_filter($own,fn($a)=>($a['choiceId']??null)===$c['id']))];
    } elseif($type==='yesno') {
        $options=$mode==='csv'?['No','Yes']:['Yes','No'];
        foreach($options as $text) { $n=count(array_filter($own,fn($a)=>($a['text']??'')===$text)); if($mode!=='csv'||$n) $rows[]=['choice_text'=>$text,'votes'=>$n]; }
    } elseif($type==='rating') {
        $ratings=array_values(array_filter(array_column($own,'rating'),fn($r)=>$r!==null)); $counts=array_count_values($ratings);
        $row+=['avg_rating'=>$ratings?round(array_sum($ratings)/count($ratings),2):0,'rating_n'=>count($ratings)];
        $keys=$mode==='report'?range(1,5):array_unique(array_merge(range(1,5),array_keys($counts))); sort($keys);
        foreach($keys as $n) if($mode!=='csv'||!empty($counts[$n])) $rows[]=$mode==='results'?['rating_value'=>$n,'votes'=>$counts[$n]??0]:['choice_text'=>$n.' star(s)','votes'=>$counts[$n]??0];
    } else {
        $own=array_values(array_filter($own,fn($a)=>($a['text']??'')!==''));
        if($mode==='results') $own=array_slice(rp_sort($own,function($a,$b) {
            // Imported answer IDs are the source's answer_id order. Fresh answers use parent submission time.
            if(($a['legacyId']??null)!==null&&($b['legacyId']??null)!==null) return $b['legacyId']<=>$a['legacyId'];
            return strcmp($b['submitted_at'],$a['submitted_at']) ?: strcmp($b['response_id'],$a['response_id']);
        }),0,200);
        else $own=rp_sort($own,fn($a,$b)=>(($a['legacyId']??PHP_INT_MAX)<=>($b['legacyId']??PHP_INT_MAX)) ?: strcmp($a['submitted_at'],$b['submitted_at']) ?: strcmp($a['response_id'],$b['response_id']));
        $rows=array_map(fn($a)=>['answer_text'=>$a['text'],'submitted_at'=>$a['submitted_at'],'submitted_at_label'=>rp_label($a['submitted_at'])],$own);
    }
    if($mode!=='results') return $row+['rows'=>$rows,'answered_here'=>$type==='short_answer'?count($rows):array_sum(array_column($rows,'votes'))];
    if($type==='short_answer') return $row+['answers'=>$rows];
    $total=array_sum(array_column($rows,'votes')); $max=max(array_merge([0],array_column($rows,'votes')));
    return $row+['total_votes'=>$total,'breakdown'=>array_map(fn($r)=>$r+['percent'=>$total?(int)round($r['votes']/$total*100):0,'winning'=>$r['votes']===$max&&$max>0],$rows)];
}
function rp_results(string $sid,string $mode,array $surveys): array {
    $s=$surveys[$sid]??null; $questions=[]; $responses=[];
    if($s) {
        $responses=rp_responses($sid); $answers=rp_answers($responses);
        $qs=rp_sort(rp_query('questions',['text','type','order','legacyId'],'surveys/'.$sid),fn($a,$b)=>($a['order']<=>$b['order']) ?: (($a['legacyId']??PHP_INT_MAX)<=>($b['legacyId']??PHP_INT_MAX)) ?: strcmp($a['id'],$b['id']));
        foreach($qs as $q) {
            $cs=$q['type']==='multiple_choice'?rp_sort(rp_query('choices',['text','order','legacyId'],'surveys/'.$sid.'/questions/'.$q['id']),fn($a,$b)=>(($a['legacyId']??$a['order'])<=>($b['legacyId']??$b['order'])) ?: strcmp($a['id'],$b['id'])):[];
            $questions[]=rp_question_result($q,$cs,$answers,$mode);
        }
        $creator=$mode==='report'&&$s['created_by']?rp_document('users/'.rawurlencode($s['created_by']),['displayName']):null;
        $s=array_intersect_key($s,array_flip(['survey_id','title','description','start_date','end_date','status']))+
            ['period_label'=>date('M d, Y',strtotime($s['start_date'])).' — '.date('M d, Y',strtotime($s['end_date']))];
        if($mode==='report') $s['created_by_name']=$creator['displayName']??null;
    }
    return ['surveys'=>array_values(array_map(fn($s)=>['survey_id'=>$s['survey_id'],'title'=>$s['title']],$surveys)),
        'survey_id'=>$sid==='0'||$sid===''?0:$sid,'survey'=>$s,'questions'=>$questions,'total_respondents'=>count($responses),'generated_on'=>date('F j, Y \a\t g:i A')];
}
function rp_csv_row($out,array $row):void { fputcsv($out,$row,',','"',chr(92)); }
function rp_csv(array $data): array {
    if(!$data['survey']) return ['ok'=>true,'data'=>null,'redirect'=>'/staff/reports'];
    $s=$data['survey']; $out=fopen('php://temp','w+');
    rp_csv_row($out,['Barangay Health Center - Survey Report']); rp_csv_row($out,['Survey Title',$s['title']]);
    rp_csv_row($out,['Period',$s['start_date'].' to '.$s['end_date']]); rp_csv_row($out,[]);
    foreach($data['questions'] as $q) {
        rp_csv_row($out,['Question',$q['question_text']]); rp_csv_row($out,['Option','Count']);
        foreach($q['rows'] as $r) rp_csv_row($out,$q['question_type']==='short_answer'?['Response',$r['answer_text']]:[$r['choice_text'],$r['votes']]);
        rp_csv_row($out,[]);
    }
    rewind($out); $csv=stream_get_contents($out); fclose($out);
    return ['ok'=>true,'data'=>['filename'=>'survey_report_'.preg_replace('/[^A-Za-z0-9_-]/','_',$s['title']).'.csv','csv'=>$csv]];
}
