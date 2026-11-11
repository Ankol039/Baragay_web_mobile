import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import usePhotoCropper from '../../hooks/usePhotoCropper.js'

export default function PhotoCropModal({ file, onClose, onChoose, onSaved, upload: uploadPhoto }) {
  // PHP's openModal clears the 1–3 range to its native midpoint and dispatches
  // input after loading the image, so the visible initial crop is at 2×.
  const { canvas: canvasRef, zoom, setZoom, preview, error: cropError, ready, dragging, jpeg, pointerProps } = usePhotoCropper(file, 2)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  async function upload() {
    if (pending.current || !ready) return
    pending.current = true; setBusy(true); setError('')
    try {
      const photo = await jpeg()
      onSaved(await uploadPhoto(photo))
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Modal id="photo-confirm-modal" title="Confirm Profile Photo" open keepOnClose narrow onClose={onClose} beforeClose={() => !busy}>
    <p className="modal-text">Review the photo before uploading. If you want a different one, choose another.</p>
    {(error || cropError) && <Alert type="error" inline>{error || cropError}</Alert>}
    <div className={`photo-cropper${dragging ? ' is-dragging' : ''}`} id="photo-cropper">
      <canvas id="photo-crop-canvas" ref={canvasRef} width={320} height={320} aria-label="Profile photo crop area" {...pointerProps} />
      <div className="photo-crop-guide" aria-hidden="true" />
    </div>
    <div className="photo-crop-controls">
      <label htmlFor="photo-zoom">Resize / Zoom</label>
      <div className="photo-zoom-row"><span aria-hidden="true">−</span>
        <input type="range" id="photo-zoom" min="1" max="3" step="0.01" value={zoom}
          aria-label="Resize profile photo" onChange={event => setZoom(event.target.value)} />
        <span aria-hidden="true">+</span></div>
      <p className="photo-crop-help">Drag the photo to reposition it. Use the slider to resize it inside the square.</p>
    </div>
    <div className="photo-preview-modal photo-final-preview"><span>Preview</span>
      <img id="photo-preview-image" src={preview || undefined} alt="Selected photo preview" /></div>
    <div className="modal-actions">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={onChoose}>Choose another</button>
      <button type="button" className="btn" disabled={busy || !ready} onClick={upload}>{busy ? 'Preparing...' : 'Confirm & Upload'}</button>
    </div>
  </Modal>
}

if (import.meta.env.DEV) {
  PhotoCropModal.propTypes = {
    file: PropTypes.shape({ name: PropTypes.string.isRequired, type: PropTypes.string.isRequired, lastModified: PropTypes.number }).isRequired,
    onClose: PropTypes.func,
    onChoose: PropTypes.func.isRequired,
    onSaved: PropTypes.func.isRequired,
    upload: PropTypes.func.isRequired,
  }
}
