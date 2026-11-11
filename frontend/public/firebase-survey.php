<?php
$project = dirname(__DIR__);
if (!is_file($project . '/api/firebase/survey-schema.php')) $project = dirname($project);
require $project . '/api/firebase/survey-schema.php';
