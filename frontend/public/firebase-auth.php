<?php
// XAMPP builds are served from project/app; direct frontend/dist serving also works.
$project = dirname(__DIR__);
if (!is_file($project . '/api/firebase/index.php')) $project = dirname($project);
require $project . '/api/firebase/index.php';
