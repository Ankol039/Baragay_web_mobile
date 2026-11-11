<?php
/** Original staff/stat_detail.php headings and columns. */
const REPORT_VIEWS = [
    'total_surveys' => [
        'title'    => 'Total Surveys',
        'subtitle' => 'Every survey ever created, newest first.',
        'unit'     => 'surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Period', 'Status', 'Responses', ''],
    ],
    'active_surveys' => [
        'title'    => 'Active Surveys',
        'subtitle' => 'Surveys marked active and currently inside their open period.',
        'unit'     => 'open surveys',
        'admin'    => false,
        'columns'  => ['Survey', 'Closes On', 'Days Left', 'Responses', ''],
    ],
    'total_residents' => [
        'title'    => 'Total Residents',
        'subtitle' => 'All registered resident accounts.',
        'unit'     => 'residents',
        'admin'    => false,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency', 'Account'],
    ],
    'total_responses' => [
        'title'    => 'Survey Responses',
        'subtitle' => 'Every response submitted, newest first.',
        'unit'     => 'responses',
        'admin'    => false,
        'columns'  => ['Survey', 'Resident', 'Submitted'],
    ],
    'staff_accounts' => [
        'title'    => 'Staff Accounts',
        'subtitle' => 'All staff and administrator accounts.',
        'unit'     => 'accounts',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Account', 'Created'],
    ],
    'deactivated_residents' => [
        'title'    => 'Deactivated Residents',
        'subtitle' => 'Resident accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated residents',
        'admin'    => true,
        'columns'  => ['Resident No.', 'Name', 'Contact', 'Residency'],
    ],
    'deactivated_staff' => [
        'title'    => 'Deactivated Staff',
        'subtitle' => 'Staff accounts that are currently blocked from logging in.',
        'unit'     => 'deactivated staff',
        'admin'    => true,
        'columns'  => ['Name', 'Username', 'Role', 'Created'],
    ],
    'recent_logins' => [
        'title'    => 'Login Activity',
        'subtitle' => 'Sign-ins across both portals, newest first.',
        'unit'     => 'sign-ins',
        'admin'    => true,
        'columns'  => ['User', 'Type', 'Date & Time'],
    ],
];
