<?php
/** Staff-specific 5 MB cap and replacement cleanup around the shared cropper. */
function api_staff_photo(mysqli $conn, bool $remove = false): void {
    $user = api_staff_profile_user($conn); $id = $user['id'];
    $conn->begin_transaction();
    $stmt = api_management_sql($conn, 'SELECT photo_path FROM staff WHERE staff_id = ? FOR UPDATE', [$id]);
    $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if ($remove) {
        if (!empty($row['photo_path'])) {
            $old = __DIR__ . '/../../' . $row['photo_path'];
            if (is_file($old)) { @unlink($old); }
        }
        $stmt = $conn->prepare('UPDATE staff SET photo_path = NULL WHERE staff_id = ?');
        $stmt->bind_param('i', $id); $stmt->execute(); $stmt->close();
        $_SESSION['staff_photo'] = null;
        $conn->commit();
        api_json(['ok' => true, 'data' => api_staff_profile_data($conn, $user)]);
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
    if ($file['size'] > 5 * 1024 * 1024) api_error('Please choose a photo under 5 MB.');
    $directory = __DIR__ . '/../../uploads/staff';
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) { api_error('Unable to create the upload directory. Please contact the administrator.'); }
    // Retain the original directory/extension, avoiding same-second overwrite.
    $path = 'uploads/staff/staff_' . $id . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $destination = __DIR__ . '/../../' . $path;
    if (!move_uploaded_file($file['tmp_name'], $destination)) { api_error('Unable to save the uploaded photo. Please try again.'); }
    try {
        $stmt = $conn->prepare('UPDATE staff SET photo_path = ? WHERE staff_id = ?');
        $stmt->bind_param('si', $path, $id); $stmt->execute(); $stmt->close();
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback(); @unlink($destination); throw $error;
    }
    if (!empty($row['photo_path']) && $row['photo_path'] !== $path) {
        $old = __DIR__ . '/../../' . $row['photo_path'];
        if (is_file($old)) @unlink($old);
    }
    api_json(['ok' => true, 'data' => api_staff_profile_data($conn, $user), 'outcome' => 'photo']);
}
