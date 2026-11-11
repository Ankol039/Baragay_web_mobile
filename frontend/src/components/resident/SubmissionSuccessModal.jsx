import PropTypes from 'prop-types'
import Modal from '../common/Modal.jsx'

export default function SubmissionSuccessModal({ submitted, onClose }) {
  return <Modal id="submitted-modal" open={Boolean(submitted)} onClose={onClose} narrow
    title="Submission confirmed" icon={<div className="modal-icon-success">✓</div>}>
    <p style={{ color: 'var(--muted)' }}>You have successfully answered the survey <strong>"{submitted?.title ?? 'the survey'}"</strong>.</p>
    <div className="modal-actions"><button type="button" className="btn" data-modal-close="">Done</button></div>
  </Modal>
}

if (import.meta.env.DEV) {
  SubmissionSuccessModal.propTypes = {
    submitted: PropTypes.shape({ title: PropTypes.string }),
    onClose: PropTypes.func,
  }
}
