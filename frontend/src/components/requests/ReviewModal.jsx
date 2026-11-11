import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import Icon from '../common/Icon.jsx'

// Resident/family PHP controls are inline; staff/deletion controls open a dialog.
export default function ReviewModal({ kind, request, action, inline = false, busy, error, onClose, onReview }) {
  const [comment, setComment] = useState('')
  const approving = action === 'approve'
  const deletion = kind === 'deletion'
  const family = kind === 'family'
  const required = !approving && (deletion || kind === 'staff')
  function submit(event, decision = action) {
    event.preventDefault()
    onReview(kind, request, decision, comment)
  }
  if (inline && kind === 'resident') return <>
    {['approve', 'reject'].map((decision, index) => <span key={decision} style={{ display: 'contents' }}>
      {index > 0 && ' '}
      <form onSubmit={event => submit(event, decision)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <input type="hidden" name="request_id" value={request.request_id} />
        <input type="hidden" name="action" value={decision} />
        <button type="submit" className={decision === 'approve' ? 'btn btn-success' : 'btn btn-secondary'} disabled={busy}>{decision === 'approve' ? 'Approve' : 'Reject'}</button>
      </form>
    </span>)}
  </>
  const buttons = inline ? <div className={family ? 'action-buttons' : undefined} style={family ? { marginTop: 10 } : { display: 'contents' }}>
    <button type="submit" className={family ? 'btn' : 'btn btn-success'} disabled={busy} onClick={event => submit(event, 'approve')}>Approve</button>{' '}
    <button type="submit" className="btn btn-secondary" disabled={busy} onClick={event => submit(event, 'reject')}>Reject</button>
  </div> : <div className="modal-form-actions">
    <button type="button" className="btn btn-secondary" data-modal-close="" disabled={busy}>Cancel</button>
    <button type="submit" disabled={busy}>{approving ? (deletion ? 'Move to Deleted Accounts' : 'Approve Change') : 'Reject Request'}</button>
  </div>
  const note = family || !inline
  const form = <form onSubmit={submit} className={inline && family ? 'inline-review-form' : undefined} style={inline && !family ? { display: 'inline-flex', gap: 8, alignItems: 'center' } : undefined}>
    {note && <><label htmlFor={`review-${kind}-${request.request_id}`}>{family ? 'Note for the resident' : 'Note'} {required && <span className="req">*</span>}</label>
      <input id={`review-${kind}-${request.request_id}`} name="review_comment" type="text" maxLength={255} required={required}
        placeholder={family ? 'e.g. Approved, spelling corrected' : 'Why you are approving or rejecting this'} value={comment} onChange={event => setComment(event.target.value)} /></>}
    {buttons}
  </form>
  if (inline) return form
  const name = deletion ? `${request.resident_name} (${request.resident_number})` : request.staff_name
  return <Modal id={deletion ? 'review-request-modal' : 'staff-review-modal'} open narrow onClose={onClose} beforeClose={() => !busy}
    title={deletion ? (approving ? 'Approve Deletion' : 'Reject Request') : (approving ? 'Approve Address Change' : 'Reject Address Change')}>
    <p className="modal-text">{deletion ? `${approving ? 'Delete ' : 'Keep '}${name}. Reason given: ${request.reason}`
      : `${approving ? 'Update ' : 'Keep the address on file for '}${name}${approving ? ` to: ${request.address}` : '.'}`}</p>
    {deletion && approving && <Alert type="info">Approving moves this resident to Deleted Accounts. Their survey responses are kept, and you can restore the account from there if this turns out to be a mistake.</Alert>}
    {error && <Alert type="error">{error}</Alert>}{form}
  </Modal>
}
export function ReviewButtons({ kind, request, busy, onOpen }) {
  const deletion = kind === 'deletion'
  return <div className="action-buttons">
    <button type="button" className={`btn-action ${deletion ? 'btn-action-danger' : 'btn-action-success'} has-label`} disabled={busy} onClick={() => onOpen({ kind, request, action: 'approve' })}>
      <Icon name={deletion ? 'trash' : 'check'} />Approve</button>
    <button type="button" className={`btn-action ${deletion ? 'btn-action-primary' : 'btn-action-danger'} has-label`} disabled={busy} onClick={() => onOpen({ kind, request, action: 'reject' })}>
      {deletion && <Icon name="check" />}Reject</button>
  </div>
}

if (import.meta.env.DEV) {
  ReviewModal.propTypes = {
    kind: PropTypes.oneOf(['resident', 'staff', 'family', 'deletion']).isRequired,
    request: record.isRequired,
    action: PropTypes.string,
    inline: PropTypes.bool,
    busy: PropTypes.bool,
    error: PropTypes.string,
    onClose: PropTypes.func,
    onReview: PropTypes.func.isRequired,
  }
  ReviewButtons.propTypes = {
    kind: PropTypes.oneOf(['resident', 'staff', 'family', 'deletion']).isRequired,
    request: record.isRequired,
    busy: PropTypes.bool,
    onOpen: PropTypes.func.isRequired,
  }
}
