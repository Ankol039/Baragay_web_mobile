import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import Card from '../common/Card.jsx'
import DetailsTable from '../common/DetailsTable.jsx'
import { RequestButton } from './ProfileOverview.jsx'

export default function ProfileDetails({ data: { resident, display, fields }, onContact, onBirthdate }) {
  const action = (label, onClick) => <button type="button" className="link-cta" onClick={onClick}>{label}</button>
  const addressRows = (prefix = '') => Object.entries(fields.address).map(([key, field]) => [field.label, resident[prefix + key]?.trim() ? resident[prefix + key] : 'N/A'])
  return <>
    <Card title="Personal Details" actions={<RequestButton onClick={onBirthdate} />}>
      <DetailsTable rows={[
        ['Birthdate', display.birthdate || action('Ask staff to add your birthdate', onBirthdate)], ['Age', display.age],
      ]} />
    </Card>
    <Card title="Contact Information" actions={<button type="button" className="btn" onClick={onContact}>Edit Contact</button>}>
      <DetailsTable rows={[
        ['Email', resident.email || action('Add your email', onContact)],
        ['Contact Number', resident.contact_number || action('Add a contact number', onContact)], ['Complete Address', resident.address || 'N/A'],
      ]} />
      <h3 className="card-head-title">Address Breakdown</h3><DetailsTable rows={addressRows()} />
      {resident.residency_status === 'temporary' && <>
        <h3 className="card-head-title">Temporary Address{resident.residence_type && <> <span className="muted-note">({display.residence_type})</span></>}</h3>
        <DetailsTable rows={[[ 'Complete Address', resident.temporary_address || 'N/A'], ...addressRows('temp_')]} />
      </>}
    </Card>
  </>
}

if (import.meta.env.DEV) {
  ProfileDetails.propTypes = {
    data: record.isRequired,
    onContact: PropTypes.func.isRequired,
    onBirthdate: PropTypes.func.isRequired,
  }
}
