import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Modal from '../common/Modal.jsx'
import Alert from '../common/Alert.jsx'
import useProfileForm from '../../hooks/useProfileForm.js'
import { saveContact } from '../../services/profileService.js'

export default function ContactForm({ data, onClose, onSaved }) {
  const form = useProfileForm({ email: data.resident.email, contact_number: data.resident.contact_number }, saveContact, onSaved)
  return <Modal id="edit-contact-modal" open keepOnClose title="Edit Contact Information" onClose={onClose}
    beforeClose={() => !form.busy && form.dirty.confirmDiscard()}>
    {form.error && <Alert type="error" inline>{form.error}</Alert>}
    <p className="muted-note">Email and contact number changes are saved immediately.</p>
    <form className="profile-request-form" {...form.dirty.formProps} onSubmit={form.submit}>
      <label htmlFor="email">Email</label>
      <input type="email" id="email" name="email" placeholder="e.g. juandelacruz@gmail.com" value={form.values.email} onChange={event => form.change('email', event.target.value)} />
      <label htmlFor="contact_number">Contact Number</label>
      <input type="tel" id="contact_number" name="contact_number" placeholder="e.g. 0917 123 4567" pattern={data.fields.contact_pattern}
        maxLength={20} title="Digits, spaces, +, - and brackets only" value={form.values.contact_number} onChange={event => form.change('contact_number', event.target.value)} />
      <button type="submit" className="btn" disabled={form.busy}>Save Email &amp; Contact</button>{' '}
      <button type="button" className="btn-secondary" data-modal-close="">Cancel</button>
    </form>
  </Modal>
}

if (import.meta.env.DEV) {
  ContactForm.propTypes = {
    data: record.isRequired,
    onClose: PropTypes.func,
    onSaved: PropTypes.func.isRequired,
  }
}
