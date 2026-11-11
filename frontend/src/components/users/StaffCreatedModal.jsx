import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { createPortal } from 'react-dom'
import Modal from '../common/Modal.jsx'
import './staff-slip.css'

function HandOverSlip({ account }) {
  return <>
    <p className="modal-text">Give these details to {account.full_name}. They will be asked to set their own password and complete their profile the first time they log in.</p>
    <dl className="credential-slip"><dt>Staff Number</dt><dd>{account.staff_number}</dd></dl>
    <p className="field-hint">They type this Staff Number as <strong>both</strong> the username and the password on their first login, the same way a resident uses their Resident Number. They set a real password immediately afterwards; the username stays the Staff Number for good. If the number is lost, reset the password from the Staff Accounts table.</p>
  </>
}
export default function StaffCreatedModal({ account, onClose }) {
  return <>
    <Modal id="new-staff-modal" open keepOnClose narrow title="Account Created" onClose={onClose} icon={<div className="modal-icon-success">✓</div>}>
      <HandOverSlip account={account} /><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button><button type="button" className="btn" data-modal-close="">Done</button></div>
    </Modal>
    {createPortal(<section className="staff-slip-print-area"><h2>Account Created</h2><HandOverSlip account={account} /></section>, document.body)}
  </>
}

if (import.meta.env.DEV) {
  HandOverSlip.propTypes = {
    account: record.isRequired,
  }
  StaffCreatedModal.propTypes = {
    account: record.isRequired,
    onClose: PropTypes.func,
  }
}
