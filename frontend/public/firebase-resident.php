<?php
$project = dirname(__DIR__);
if (!is_file($project . '/api/firebase/resident-read.php')) $project = dirname($project);
require $project . '/api/firebase/resident-read.php';
