<?php
/** Standalone equivalent of resident/ajax_stats.php; dashboard also includes this series. */
function api_resident_stats(mysqli $conn): void {
$resident_id = api_resident_id($conn);

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

api_json(['ok' => true, 'data' => ['completion' => [
    ['label' => 'Completed', 'value' => $answered],
    ['label' => 'Available', 'value' => $available],
]]]);
}
