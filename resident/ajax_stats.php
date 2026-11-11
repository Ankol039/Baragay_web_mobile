<?php
/**
 * Returns JSON statistics for the resident dashboard chart.
 * Called client-side via fetch() (AJAX) from dashboard.php.
 */
require_once '../config/db.php';
require_once '../config/functions.php';
require_resident_login();

header('Content-Type: application/json');

$resident_id = $_SESSION['resident_id'];

$stmt = $conn->prepare("
    SELECT COUNT(*) AS cnt FROM surveys s
    WHERE s.status = 'active' AND CURDATE() BETWEEN s.start_date AND s.end_date
    AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.survey_id = s.survey_id AND r.resident_id = ?)
");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$available = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

$stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM responses WHERE resident_id = ?");
$stmt->bind_param('i', $resident_id);
$stmt->execute();
$answered = (int)$stmt->get_result()->fetch_assoc()['cnt'];
$stmt->close();

echo json_encode([
    'completion' => [
        ['label' => 'Completed', 'value' => $answered],
        ['label' => 'Available', 'value' => $available],
    ],
]);
