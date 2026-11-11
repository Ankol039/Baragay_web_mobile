import PropTypes from 'prop-types'
import Modal from './Modal.jsx'

export default function ConfirmModal({ id = 'confirm-modal', open, message = 'Are you sure you want to proceed?', onClose, onConfirm }) {
  return <Modal id={id} open={open} onClose={onClose} keepOnClose narrow title="Please Confirm"
    icon={<div className="modal-icon-warning">!</div>}>
    <p id={`${id}-message`} className="modal-text">{message}</p>
    <div className="modal-actions">
      <button type="button" className="btn btn-secondary" data-modal-close="">Cancel</button>
      <a href="#" id={`${id}-proceed`} className="btn btn-danger" onClick={(event) => { event.preventDefault(); onConfirm() }}>Yes, Continue</a>
    </div>
  </Modal>
}

if (import.meta.env.DEV) {
  ConfirmModal.propTypes = {
    id: PropTypes.string,
    open: PropTypes.bool.isRequired,
    message: PropTypes.node,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func.isRequired,
  }
}
