import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import Modal from '../common/Modal.jsx'

const outcomes = {
  first: ['You are all set', 'Your account is ready. You now have full access to the staff portal.'],
  photo: ['Photo Updated', 'Your profile photo has been updated.'],
  requested: ['Request Sent', 'Your contact details were saved. The address change was sent to the administrator for review — your address on file is unchanged until they approve it.'],
  normal: ['Profile Saved', 'Your details have been updated.'],
}
export default function ProfileSuccessModal({ outcome, onClose }) {
  const [title, message] = outcomes[outcome] || outcomes.normal
  return <Modal id="profile-success-modal" open={!!outcome} keepOnClose narrow title={title} onClose={onClose} icon={<div className="modal-icon-success">✓</div>}>
    <p className="modal-text">{message}</p><div className="modal-actions"><Link className="btn" to="/staff/dashboard">Go to Dashboard</Link><button type="button" className="btn btn-secondary" data-modal-close="">Stay Here</button></div>
  </Modal>
}

if (import.meta.env.DEV) {
  ProfileSuccessModal.propTypes = {
    outcome: PropTypes.string,
    onClose: PropTypes.func,
  }
}
