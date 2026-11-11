import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import Card from '../common/Card.jsx'
import Alert from '../common/Alert.jsx'
import PhotoCropModal from './PhotoCropModal.jsx'

export default function PhotoUploader({ photo, onSaved, upload, remove: removePhoto, alt = "Resident Photo" }) {
  const input = useRef(null)
  const pending = useRef(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function close() { setFile(null); input.current.value = '' }
  function choose() { close(); input.current.click() }
  async function remove(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { onSaved(await removePhoto(), 'remove') }
    catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <Card className="photo-card" title="Profile Photo">
      {error && <Alert type="error" inline>{error}</Alert>}
      {photo ? <img className="profile-photo-preview" src={photo} alt={alt} />
        : <div className="photo-placeholder">No photo uploaded</div>}
      <div className="photo-card-actions">
        <label htmlFor="profile_photo" className="btn" id="select-profile-photo-btn">Upload Photo</label>
        {photo && <form className="photo-remove-form" onSubmit={remove}><button type="submit" className="btn btn-secondary" disabled={busy}
          data-confirm="Remove your profile photo? Your initial will be shown instead.">Remove Photo</button></form>}
      </div>
      <form id="photo-upload-form" className="profile-photo-form" onSubmit={event => event.preventDefault()}>
        <input type="file" id="profile_photo" name="profile_photo" accept="image/*" ref={input} onChange={event => {
          const selected = event.target.files?.[0]
          if (!selected) return
          if (!selected.type.startsWith('image/')) { window.alert('Please select a valid image file.'); event.target.value = ''; return }
          setFile(selected)
        }} />
      </form>
    </Card>
    {file && <PhotoCropModal key={`${file.name}-${file.lastModified}`} file={file} upload={upload} onClose={close} onChoose={choose}
      onSaved={result => { close(); onSaved(result, 'photo') }} />}
  </>
}

if (import.meta.env.DEV) {
  PhotoUploader.propTypes = {
    photo: PropTypes.string,
    onSaved: PropTypes.func.isRequired,
    upload: PropTypes.func.isRequired,
    remove: PropTypes.func.isRequired,
    alt: PropTypes.string,
  }
}
