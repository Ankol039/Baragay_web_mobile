import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
import DetailsTable from '../common/DetailsTable.jsx'
import Card from '../common/Card.jsx'

export const RequestButton = ({ onClick }) => <button type="button" className="btn" onClick={onClick}>Request Change</button>

export default function ProfileOverview({ resident, display, onRequest }) {
  const rows = [['Resident Number', <>{`${resident.resident_number} `}<span className="muted-note">(cannot be changed)</span></>],
    ['Courtesy Title', resident.courtesy_title || 'N/A'], ['Full Name', display.full_name], ['First Name', resident.first_name],
    ['Middle Name', resident.middle_name || 'N/A'], ['Surname', resident.last_name], ['Extension Name', resident.name_extension || 'N/A'], ['Gender', display.gender]]
  return <Card className="profile-card" title="Profile Overview" actions={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <RequestButton onClick={onRequest} /></div>}><DetailsTable rows={rows} /></Card>
}

if (import.meta.env.DEV) {
  RequestButton.propTypes = {
    onClick: PropTypes.func.isRequired,
  }
  ProfileOverview.propTypes = {
    resident: record.isRequired,
    display: record.isRequired,
    onRequest: PropTypes.func.isRequired,
  }
}
