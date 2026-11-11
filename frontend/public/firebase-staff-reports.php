<?php
$project = dirname(__DIR__);
if (!is_file($project . '/api/firebase/staff-reports.php')) $project = dirname($project);
require $project . '/api/firebase/staff-reports.php';
