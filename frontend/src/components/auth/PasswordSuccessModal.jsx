import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import Modal from '../common/Modal.jsx'

export default function PasswordSuccessModal({ message, portal, onClose }) {
  return (
    <Modal id="password-success-modal" open onClose={onClose} keepOnClose narrow title="Password Changed"
      icon={<div className="modal-icon-success">✓</div>}>
        <p className="modal-text">{message}</p>
        <div className="modal-actions">
          <Link className="btn" to={`/${portal}/dashboard`}>Go to Dashboard</Link>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Stay Here</button>
        </div>
    </Modal>
  )
}

if (import.meta.env.DEV) {
  PasswordSuccessModal.propTypes = {
    message: PropTypes.node.isRequired,
    portal: PropTypes.oneOf(['resident', 'staff']).isRequired,
    onClose: PropTypes.func,
  }
}
