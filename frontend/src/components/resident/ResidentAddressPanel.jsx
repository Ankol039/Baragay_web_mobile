import { record } from '../../propTypes.js'
import { Link } from 'react-router-dom'
import ChartCard from '../charts/ChartCard.jsx'

const part = (row, key) => String(row[key] || '').trim() || '—'
export default function ResidentAddressPanel({ data }) {
  const { me, is_temporary: temporary, residence_code: code, residence_name: name } = data
  const fields = temporary
    ? [['Barangay', 'temp_barangay'], ['Municipality / City', 'temp_municipality'], ['Province', 'temp_province']]
    : [['Household Number', 'household_number'], ['Barangay', 'barangay'], ['Municipality / City', 'municipality'], ['Province', 'province']]
  const address = temporary ? me.temporary_address : me.address
  return <ChartCard title={temporary ? 'Where You Are Staying' : 'Your Registered Address'}
    note={temporary ? 'The address the health center uses to reach you now.' : 'Where the health center has you on record.'}
    className={`${temporary ? 'db-panel-accent ' : ''}db-c4`}
    meta={<span className={`db-pill db-pill-${temporary ? 'temporary' : 'permanent'}`}>{temporary ? 'Temporary' : 'Permanent'}</span>}>
    <div className="db-address-line">
      {temporary && name !== '' && <><strong>{code} · {name}</strong><br /></>}
      {address.trim() !== '' ? address : temporary ? 'No temporary address recorded yet.' : 'No address recorded yet.'}
    </div>
    <dl className="db-facts">{fields.map(([label, field]) => <div className="db-fact" key={field}><dt>{label}</dt><dd>{part(me, field)}</dd></div>)}</dl>
    {temporary && <dl className="db-facts" style={{ marginTop: 14 }}><div className="db-fact"><dt>Permanent Address</dt><dd>{me.address.trim() !== '' ? me.address : '—'}</dd></div></dl>}
    <p className="db-panel-note" style={{ marginTop: temporary ? 12 : 14 }}>
      Address changes are reviewed by barangay staff. Request one from <Link to="/resident/profile">My Profile</Link>.
    </p>
  </ChartCard>
}

if (import.meta.env.DEV) {
  ResidentAddressPanel.propTypes = {
    data: record.isRequired,
  }
}
