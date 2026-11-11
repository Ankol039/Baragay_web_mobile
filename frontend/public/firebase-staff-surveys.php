<?php
$project = dirname(__DIR__);
if (!is_file($project . '/api/firebase/staff-surveys.php')) $project = dirname($project);
require $project . '/api/firebase/staff-surveys.php';
