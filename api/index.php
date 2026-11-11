<?php
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/session.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/resident.php';
require_once __DIR__ . '/lib/resident-stats.php';
require_once __DIR__ . '/lib/surveys.php';
require_once __DIR__ . '/lib/survey-submit.php';
require_once __DIR__ . '/lib/survey-responses.php';
require_once __DIR__ . '/lib/profile.php';
require_once __DIR__ . '/lib/profile-requests.php';
require_once __DIR__ . '/lib/profile-photo.php';
require_once __DIR__ . '/lib/staff-dashboard.php';
require_once __DIR__ . '/lib/staff-stats.php';
require_once __DIR__ . '/lib/staff-surveys.php';
require_once __DIR__ . '/lib/staff-questions.php';

require_once __DIR__ . '/lib/staff-results.php';
require_once __DIR__ . '/lib/staff-report-export.php';
require_once __DIR__ . '/lib/staff-stat-detail.php';

require_once __DIR__ . '/lib/staff-residents.php';
require_once __DIR__ . '/lib/staff-resident-add.php';
require_once __DIR__ . '/lib/staff-resident-actions.php';
require_once __DIR__ . '/lib/staff-resident-update.php';
require_once __DIR__ . '/lib/staff-resident-residency.php';
require_once __DIR__ . '/lib/staff-resident-detail.php';

require_once __DIR__ . '/lib/request-apply.php';
require_once __DIR__ . '/lib/request-review.php';
require_once __DIR__ . '/lib/request-lists.php';
require_once __DIR__ . '/lib/account-archive.php';

require_once __DIR__ . '/lib/staff-users.php';
require_once __DIR__ . '/lib/staff-profile.php';
require_once __DIR__ . '/lib/staff-profile-save.php';
require_once __DIR__ . '/lib/staff-photo.php';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$route = substr($path, strlen($base));
$routes = ['staff/users' => ['GET', 'POST'], 'staff/user/toggle' => 'POST', 'staff/user/delete' => 'POST', 'staff/user/password-reset' => 'POST', 'staff/user/resident-toggle' => 'POST', 'staff/profile' => ['GET', 'POST'], 'staff/photo' => 'POST', 'staff/photo/remove' => 'POST', 'staff/address-requests' => 'GET', 'staff/deletion-requests' => 'GET', 'staff/deleted-accounts' => 'GET', 'staff/residency-records' => 'GET', 'staff/address-request/review' => 'POST', 'staff/staff-address-request/review' => 'POST', 'staff/family-request/review' => 'POST', 'staff/deletion-request/review' => 'POST', 'staff/deleted-account/restore' => 'POST', 'staff/deleted-account/purge' => 'POST', 'staff/resident' => 'GET', 'staff/resident/update' => 'POST', 'staff/resident/password-reset' => 'POST', 'staff/resident/toggle' => 'POST', 'staff/resident/delete' => 'POST', 'staff/resident/request-delete' => 'POST', 'staff/resident/promote' => 'POST', 'staff/resident/revert' => 'POST', 'staff/residents' => ['GET', 'POST'], 'staff/results' => 'GET', 'staff/report' => 'GET', 'staff/report-export' => 'GET', 'staff/stat-detail' => 'GET', 'staff/surveys' => ['GET', 'POST'], 'staff/survey' => 'GET',
    'staff/survey/update' => 'POST', 'staff/survey/toggle' => 'POST', 'staff/survey/delete' => 'POST',
    'staff/questions' => ['GET', 'POST'], 'staff/question/update' => 'POST', 'staff/question/delete' => 'POST', 'staff/question/move' => 'POST', 'staff/dashboard' => 'GET', 'staff/stats' => 'GET', 'login' => 'POST', 'logout' => 'POST', 'session' => 'GET', 'change-password' => 'POST',
    'resident/dashboard' => 'GET', 'resident/stats' => 'GET', 'resident/stat-detail' => 'GET',
    'resident/surveys' => 'GET', 'resident/survey-form' => 'GET', 'resident/survey-submissions' => 'POST',
    'resident/history' => 'GET', 'resident/response' => 'GET', 'resident/response-export' => 'GET', 'resident/confirmation' => 'GET',
    'resident/profile' => 'GET', 'resident/contact' => 'POST', 'resident/birthdate-requests' => 'POST',
    'resident/name-address-requests' => 'POST', 'resident/family-requests' => 'POST',
    'resident/photo' => 'POST', 'resident/photo/remove' => 'POST'];
$route = trim($route, '/');
if (!isset($routes[$route])) {
    api_error('API endpoint not found.', 404);
}
if (!in_array($_SERVER['REQUEST_METHOD'], (array)$routes[$route], true)) {
    header('Allow: ' . implode(', ', (array)$routes[$route]));
    api_error('Method not allowed.', 405);
}

switch ($route) {
    case 'staff/users': api_staff_users($conn); break;
    case 'staff/user/toggle': api_staff_user_action($conn, 'toggle'); break;
    case 'staff/user/delete': api_staff_user_action($conn, 'delete'); break;
    case 'staff/user/password-reset': api_staff_user_action($conn, 'password-reset'); break;
    case 'staff/user/resident-toggle': api_user_resident_toggle($conn); break;
    case 'staff/profile': api_staff_profile($conn); break;
    case 'staff/photo': api_staff_photo($conn); break;
    case 'staff/photo/remove': api_staff_photo($conn, true); break;

    case 'staff/address-requests': api_address_requests($conn); break;
    case 'staff/deletion-requests': api_deletion_requests($conn); break;
    case 'staff/deleted-accounts': api_deleted_accounts($conn); break;
    case 'staff/residency-records': api_residency_records($conn); break;
    case 'staff/address-request/review': api_request_review($conn, 'resident'); break;
    case 'staff/staff-address-request/review': api_request_review($conn, 'staff'); break;
    case 'staff/family-request/review': api_request_review($conn, 'family'); break;
    case 'staff/deletion-request/review': api_request_review($conn, 'deletion'); break;
    case 'staff/deleted-account/restore': api_archive_action($conn, 'restore'); break;
    case 'staff/deleted-account/purge': api_archive_action($conn, 'purge'); break;

    case 'staff/resident': api_staff_resident_detail($conn); break;
    case 'staff/resident/update': api_staff_resident_action($conn, 'update'); break;
    case 'staff/resident/password-reset': api_staff_resident_action($conn, 'password-reset'); break;
    case 'staff/resident/toggle': api_staff_resident_action($conn, 'toggle'); break;
    case 'staff/resident/delete': api_staff_resident_action($conn, 'delete'); break;
    case 'staff/resident/request-delete': api_staff_resident_action($conn, 'request-delete'); break;
    case 'staff/resident/promote': api_staff_resident_action($conn, 'promote'); break;
    case 'staff/resident/revert': api_staff_resident_action($conn, 'revert'); break;

    case 'staff/residents': api_staff_residents($conn); break;
    case 'staff/results': api_staff_results($conn); break;
    case 'staff/report': api_staff_report($conn); break;
    case 'staff/report-export': api_staff_report_export($conn); break;
    case 'staff/stat-detail': api_staff_stat_detail($conn); break;
    case 'staff/surveys': api_staff_surveys($conn); break;
    case 'staff/survey': api_staff_survey($conn, 'read'); break;
    case 'staff/survey/update': api_staff_survey($conn, 'update'); break;
    case 'staff/survey/toggle': api_staff_survey($conn, 'toggle'); break;
    case 'staff/survey/delete': api_staff_survey($conn, 'delete'); break;
    case 'staff/questions': api_staff_questions($conn, $_SERVER['REQUEST_METHOD'] === 'GET' ? 'read' : 'create'); break;
    case 'staff/question/update': api_staff_questions($conn, 'update'); break;
    case 'staff/question/delete': api_staff_questions($conn, 'delete'); break;
    case 'staff/question/move': api_staff_questions($conn, 'move'); break;
    case 'staff/dashboard': api_staff_dashboard($conn); break;
    case 'staff/stats': api_staff_stats($conn); break;
    case 'resident/stats': api_resident_stats($conn); break;
    case 'resident/profile': api_resident_profile($conn); break;
    case 'resident/contact': api_resident_contact($conn); break;
    case 'resident/birthdate-requests': api_resident_birthdate_request($conn); break;
    case 'resident/name-address-requests': api_resident_name_address_request($conn); break;
    case 'resident/family-requests': api_resident_family_request($conn); break;
    case 'resident/photo': api_resident_photo($conn); break;
    case 'resident/photo/remove': api_resident_photo($conn, true); break;
    case 'resident/surveys': api_resident_surveys($conn); break;
    case 'resident/confirmation': api_resident_confirmation($conn); break;
    case 'resident/survey-form': api_resident_survey_form($conn); break;
    case 'resident/survey-submissions': api_resident_survey_submit($conn); break;
    case 'resident/history': api_resident_history($conn); break;
    case 'resident/response': api_resident_response($conn); break;
    case 'resident/response-export': api_resident_response($conn, true); break;
    case 'resident/dashboard':
        api_resident_dashboard($conn);
        break;
    case 'resident/stat-detail':
        api_resident_stat_detail($conn);
        break;
    case 'login':
        api_login($conn);
        break;
    case 'logout':
        api_logout($conn);
        api_json(['ok' => true, 'data' => ['authenticated' => false, 'user' => null], 'redirect' => '/landing']);
        break;
    case 'session':
        $user = api_current_user($conn);
        api_json(['ok' => true, 'data' => api_session_data($user), 'redirect' => api_next_route($user)]);
        break;
    case 'change-password':
        api_change_password($conn);
        break;
}
