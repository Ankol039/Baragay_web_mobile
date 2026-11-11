<?php
/** Same resident upload policy as profile.php (no staff-only size cap). */
function api_resident_photo(mysqli $conn, bool $remove = false): void {
    $id = api_resident_id($conn);
    $row = api_profile_lock($conn, $id);
    if ($remove) {
        if (!empty($row['photo_path'])) {
            $old = __DIR__ . '/../../' . $row['photo_path'];
            if (is_file($old)) { @unlink($old); }
        }
        $stmt = $conn->prepare('UPDATE residents SET photo_path = NULL WHERE resident_id = ?');
        $stmt->bind_param('i', $id); $stmt->execute(); $stmt->close();
        $_SESSION['resident_photo'] = null;
        api_profile_done($conn, $id, 'Profile photo removed. Your initial is shown instead.');
    }
    $file = $_FILES['profile_photo'] ?? null;
    if (!$file || !isset($file['error'])) { api_error('Please select a photo to upload.'); }
    if (!is_int($file['error'])) { api_error('There was a problem uploading your photo. Please try again.'); }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $messages = [UPLOAD_ERR_INI_SIZE => 'The selected photo is too large.', UPLOAD_ERR_FORM_SIZE => 'The selected photo is too large.',
            UPLOAD_ERR_PARTIAL => 'The upload was interrupted. Please try again.', UPLOAD_ERR_NO_FILE => 'Please select a photo to upload.'];
        api_error($messages[$file['error']] ?? 'There was a problem uploading your photo. Please try again.');
    }
    $info = @getimagesize($file['tmp_name']);
    $ext = strtolower(pathinfo(basename($file['name']), PATHINFO_EXTENSION));
    if ($info === false) { api_error('Uploaded file must be a valid image.'); }
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) { api_error('Only JPG, PNG, GIF, or WEBP images are allowed.'); }
    $directory = __DIR__ . '/../../uploads/residents';
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) { api_error('Unable to create the upload directory. Please contact support.'); }
    // Retain the original directory/extension, avoiding same-second overwrite.
    $path = 'uploads/residents/resident_' . $id . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destination = __DIR__ . '/../../' . $path;
    if (!move_uploaded_file($file['tmp_name'], $destination)) { api_error('Unable to save the uploaded photo. Please try again.'); }
    try {
        $stmt = $conn->prepare('UPDATE residents SET photo_path = ? WHERE resident_id = ?');
        $stmt->bind_param('si', $path, $id); $stmt->execute(); $stmt->close();
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback(); @unlink($destination); throw $error;
    }
    api_json(['ok' => true, 'data' => api_profile_data($conn, $id), 'message' => 'Profile photo uploaded successfully.']);
}
