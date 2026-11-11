<?php
/**
 * The resident login form now lives at the site root (index.php), which is
 * the single public login page for the system. This stub exists only so
 * that internal redirects like redirect('login.php') from other files in
 * this folder keep working.
 */
require_once '../config/functions.php';
redirect('../index.php');
