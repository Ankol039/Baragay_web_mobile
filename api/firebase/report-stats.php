<?php
function rp_trend(array $responses, array $input): array {
    $valid = function($value) { $d = is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d',$value) : false; return $d && $d->format('Y-m-d') === $value ? $value : null; };
    $to = $valid($input['to'] ?? '') ?? date('Y-m-d');
    $from = $valid($input['from'] ?? '') ?? date('Y-m-d',strtotime('-29 days',strtotime($to)));
    if ($from > $to) [$from,$to] = [$to,$from];
    $span = min(365,(int)floor((strtotime($to)-strtotime($from))/86400));
    $counts = array_count_values(array_map(fn($r) => rp_day($r['submittedAt']),$responses));
    $rows = [];
    for ($i=$span;$i>=0;$i--) { $day = date('Y-m-d',strtotime("-$i days",strtotime($to))); $rows[] = ['label' => date('M j',strtotime($day)),'value' => $counts[$day] ?? 0]; }
    return $rows;
}
function rp_group(array $rows, string $field, array $labels): array {
    $counts = array_count_values(array_map(fn($r) => $r[$field] ?: ($field === 'gender' ? 'unstated' : 'none'),$rows)); $result=[];
    foreach ($labels as $key=>$label) if (!empty($counts[$key])) $result[]=['label'=>$label,'value'=>$counts[$key]];
    return $result;
}
function rp_top_groups(array $rows, string $field, bool $occupation=false): array {
    $counts=[];
    foreach ($rows as $r) {
        $text=trim($r[$field]); if ($text === '' || ($occupation && in_array(strtoupper($text),['N/A','NA','NONE'],true))) continue;
        $key=mb_strtoupper(class_exists('Normalizer') ? preg_replace('/\p{M}/u','',Normalizer::normalize($text,Normalizer::FORM_KD)) : $text,'UTF-8');
        if (!isset($counts[$key])) $counts[$key]=['label'=>$text,'value'=>0]; $counts[$key]['value']++;
    }
    return array_slice(rp_sort(array_values($counts),fn($a,$b)=>($b['value']<=>$a['value']) ?: rp_compare($a['label'],$b['label'])),0,7);
}
function rp_stats(array $surveys,array $responses,array $residents,array $types,array $input): array {
    $live=array_values(array_filter($residents,fn($r)=>$r['deleted_at']===null));
    $counts=array_count_values(array_column($responses,'surveyId')); $status=array_count_values(array_column($surveys,'status'));
    $typeCounts=array_count_values(array_column($types,'type')); arsort($typeCounts);
    $typeLabels=['multiple_choice'=>'Multiple Choice','yesno'=>'Yes / No','rating'=>'Rating Scale','short_answer'=>'Short Answer'];
    $typeRows=[]; foreach($typeCounts as $key=>$n) $typeRows[]=['label'=>$typeLabels[$key]??ucwords(str_replace('_',' ',$key)),'value'=>$n];
    $ages=[0,0,0,0];
    foreach($live as $r) if($r['birthdate']) { $born=new DateTimeImmutable($r['birthdate']); $today=new DateTimeImmutable('today'); $age=(int)$born->diff($today)->format('%r%y'); $ages[$age<18?0:($age<35?1:($age<60?2:3))]++; }
    $temporary=count(array_filter($live,fn($r)=>$r['residency_status']==='temporary'));
    $married=count(array_filter($live,fn($r)=>$r['is_married'])); $children=count(array_filter($live,fn($r)=>$r['has_children']));
    $statusRows=[]; foreach(['active','inactive'] as $key) if(isset($status[$key])) $statusRows[]=['label'=>ucfirst($key),'value'=>$status[$key]];
    return ['responses_per_survey'=>array_map(fn($s)=>['label'=>$s['title'],'value'=>$counts[$s['survey_id']]??0],array_slice(array_values($surveys),0,8)),
        'survey_status'=>$statusRows,'response_trend'=>rp_trend($responses,$input),'residency_mix'=>[['label'=>'Permanent','value'=>count($live)-$temporary],['label'=>'Temporary','value'=>$temporary]],
        'question_types'=>$typeRows,'age_groups'=>array_map(fn($label,$value)=>['label'=>$label,'value'=>$value],['Under 18','18 - 34','35 - 59','60 and over'],$ages),
        'gender_mix'=>rp_group($live,'gender',gender_options()+['unstated'=>'Not recorded']),
        'priority_groups'=>rp_group($live,'special_category',['pwd'=>'PWD','senior_citizen'=>'Senior Citizen','pregnant'=>'Pregnant','none'=>'No priority group']),
        'occupations'=>rp_top_groups($live,'occupation',true),'purok_mix'=>rp_top_groups($live,'purok'),
        'household'=>[['label'=>'Married','value'=>$married],['label'=>'Not married','value'=>count($live)-$married],['label'=>'With children','value'=>$children],['label'=>'No children','value'=>count($live)-$children]]];
}
