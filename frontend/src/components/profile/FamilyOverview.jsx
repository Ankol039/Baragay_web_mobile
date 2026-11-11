import PropTypes from 'prop-types'
import { fieldSpec, record } from '../../propTypes.js'
import Card from '../common/Card.jsx'
import Alert from '../common/Alert.jsx'
import DetailsTable from '../common/DetailsTable.jsx'
import { RequestButton } from './ProfileOverview.jsx'

function PersonDetails({ heading, person, spec }) {
  const rows = Object.entries(spec).map(([key, field]) => [field.label, person[key]])
  rows.splice(1, 0, ['Full Name', person.full_name])
  return <><h3 className="card-head-title">{heading}</h3>{person.full_name ? <DetailsTable rows={rows} /> : <p className="muted-note">Not recorded.</p>}</>
}
export default function FamilyOverview({ data: { resident, display, fields, pending_family_request: pending }, onRequest }) {
  const person = (who, heading) => <PersonDetails heading={heading} person={display[who]} spec={fields.person} />
  return <Card title="Family & Household" actions={<RequestButton onClick={onRequest} />}>
    <p className="muted-note" style={{ marginTop: -4 }}>{pending ? 'You have a change waiting for review. The details below are what is on file now.'
      : 'Ask barangay staff to review any correction needed here.'}</p>
    {pending && <Alert inline>Requested {pending.requested_at_label}. Nothing changes until staff approve it.</Alert>}
    <DetailsTable rows={[
      ['Occupation', resident.occupation.trim() ? resident.occupation : 'N/A'], ['Hotline Number', resident.hotline_number.trim() ? resident.hotline_number : 'N/A'],
      ['Marital Status', resident.is_married === '1' ? 'Married' : 'Not married'],
    ]} />
    {resident.is_married === '1' && person('spouse', 'Spouse')}{person('father', 'Father')}{person('mother', 'Mother')}
    {display.children.length ? display.children.map((child, index) => <PersonDetails key={index} heading={`Child ${index + 1}`} person={child} spec={fields.person} />)
      : <><h3 className="card-head-title">Children</h3><p className="muted-note">None on record.</p></>}
    {display.references.length ? display.references.map((reference, index) => <PersonDetails key={index} heading={`Character Reference ${index + 1}`} person={reference} spec={fields.person} />)
      : <><h3 className="card-head-title">Character References</h3><p className="muted-note">None on record. Ask staff to add at least one.</p></>}
  </Card>
}

if (import.meta.env.DEV) {
  PersonDetails.propTypes = {
    heading: PropTypes.node.isRequired,
    person: record.isRequired,
    spec: fieldSpec.isRequired,
  }
  FamilyOverview.propTypes = {
    data: record.isRequired,
    onRequest: PropTypes.func.isRequired,
  }
}
