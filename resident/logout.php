<?php
require_once '../config/db.php';
require_once '../config/functions.php';

// Record the sign-out before the session is torn down, while we still know
// who is leaving.
if (!empty($_SESSION['resident_id'])) {
    log_logout($conn, 'resident', (int)$_SESSION['resident_id']);
}

session_unset();
session_destroy();
redirect('login.php');
