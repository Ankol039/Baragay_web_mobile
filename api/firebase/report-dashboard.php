<?php
/** Dashboard arithmetic follows staff/dashboard.php, including its historical counting quirks. */
function rp_open(array $s): bool { $today = date('Y-m-d'); return $s['status'] === 'active' && $s['start_date'] <= $today && $s['end_date'] >= $today; }
function rp_dashboard(array $surveys, array $responses, array $residents, array $users, bool $admin): array {
    $live = array_filter($residents, fn($r) => $r['deleted_at'] === null);
    $eligible = count(array_filter($live, fn($r) => $r['is_active']));
    $counts = array_count_values(array_column($responses,'surveyId'));
    $ranking = array_count_values(array_column($responses,'residentUid'));
    $recent = count(array_filter($responses, fn($r) => strtotime($r['submittedAt']) >= strtotime('-7 days',strtotime('today'))));
    $previous = count(array_filter($responses, fn($r) => strtotime($r['submittedAt']) >= strtotime('-14 days',strtotime('today')) && strtotime($r['submittedAt']) < strtotime('-7 days',strtotime('today'))));
    [$direction,$delta] = api_staff_delta($recent,$previous);
    $rows = array_values(array_map(fn($s) => $s + ['response_count' => $counts[$s['survey_id']] ?? 0],$surveys));
    $completion = array_map(fn($s) => ['survey_id' => $s['survey_id'],'title' => $s['title'],'answered' => $s['response_count'],
        'pct' => $eligible ? min(100,(int)round($s['response_count']/$eligible*100)) : 0],array_filter($rows,fn($s) => $s['status'] === 'active'));
    $completion = array_slice(rp_sort(array_values($completion),fn($a,$b) => $b['answered'] <=> $a['answered']),0,6);
    $top = [];
    foreach ($ranking as $uid => $n) if (isset($residents[$uid])) $top[] = $residents[$uid] + ['answered' => $n];
    $top = array_slice(rp_sort($top,fn($a,$b) => ($b['answered'] <=> $a['answered']) ?: rp_compare($a['last_name'],$b['last_name'])),0,5);
    $latest = $responses ? max(array_map(fn($r) => strtotime($r['submittedAt']),$responses)) : null;
    $temporary = count(array_filter($live,fn($r) => $r['residency_status'] === 'temporary'));
    $data = ['total_surveys' => count($surveys),'active_surveys' => count(array_filter($surveys,'rp_open')),'total_residents' => count($live),
        'total_responses' => count($responses),'inactive_surveys' => count(array_filter($surveys,fn($s) => $s['status'] === 'inactive')),
        'closed_surveys' => count(array_filter($surveys,fn($s) => $s['end_date'] < date('Y-m-d'))), 'avg_responses' => $surveys ? round(count($responses)/count($surveys),1) : 0,
        'responses_7' => $recent,'responses_prev_7' => $previous,'new_residents_30' => count(array_filter($live,fn($r) => strtotime($r['created_at']) >= strtotime('-30 days',strtotime('today')))),
        'permanent_residents' => count($live)-$temporary,'temporary_residents' => $temporary,'eligible_residents' => $eligible,
        'responding_residents' => count($ranking),'participation' => $eligible ? min(100,(int)round(count($ranking)/$eligible*100)) : 0,
        'pending_address_requests' => count(rp_query('nameAddressRequests',['status'],'',['status','pending'])),
        'as_of' => date('F j, Y'),'today' => date('Y-m-d'),'trend_from' => date('Y-m-d',strtotime('-29 days')),
        'resp_dir' => $direction,'resp_delta' => $delta,'latest_response_label' => $latest ? date('M j, Y',$latest) : '—',
        'surveys_overview' => array_slice($rows,0,8),'completion_rates' => $completion,'top_responders' => $top,
        'demographics_ready' => (bool)$live,'is_admin_view' => $admin];
    if ($admin) {
        $staff = array_filter($users,fn($u) => in_array($u['role'],['staff','admin'],true) && ($u['deletedAt'] ?? null) === null);
        $logins = rp_activity($users,$residents,'login'); $logouts = rp_activity($users,$residents,'logout');
        $data['admin'] = ['total_staff' => count($staff),'deactivated_staff' => count(array_filter($staff,fn($s) => !$s['isActive'])),
            'deactivated_residents' => count(array_filter($live,fn($r) => !$r['is_active'])),
            'pending_deletion_requests' => count(rp_query('deletionRequests',['status'],'',['status','pending'])),
            'login_counts' => api_staff_portal_breakdown($logins),'logout_counts' => api_staff_portal_breakdown($logouts),
            'recent_logins' => array_map(fn($r) => array_intersect_key($r,array_flip(['person','type_label','time_label'])),$logins),
            'recent_logouts' => array_map(fn($r) => array_intersect_key($r,array_flip(['person','type_label','time_label'])),$logouts)];
    }
    // Allowlisted output prevents household/contact/lifecycle metadata reaching chart components.
    $data['surveys_overview'] = array_map(fn($r) => array_intersect_key($r,array_flip(['survey_id','title','start_date','end_date','status','response_count'])),$data['surveys_overview']);
    $data['top_responders'] = array_map(fn($r) => array_intersect_key($r,array_flip(['resident_id','resident_number','first_name','last_name','answered'])),$data['top_responders']);
    return $data;
}
