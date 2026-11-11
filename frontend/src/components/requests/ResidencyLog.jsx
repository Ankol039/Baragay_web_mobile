import { record } from '../../propTypes.js'
import { useState } from 'react'

const cap = value => value.charAt(0).toUpperCase() + value.slice(1)
const titles = { '': 'Change History', permanent: 'Made Permanent', temporary: 'Reverted to Temporary' }
const notes = { '': 'Newest first. An archived address stays here even after the resident is deleted.', permanent: 'Residents who were moved from temporary to permanent, newest first.', temporary: 'Residents who were returned to temporary status, newest first.' }
export default function ResidencyLog({ data }) {
  const [search, setSearch] = useState('')
  const { filter, changes } = data
  const matches = r => `${r.resident_number || ''} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase())
  return <div className="card">
    <div className="card-head"><div><h2 className="card-head-title">{titles[filter]}</h2><p className="muted-note">{notes[filter]}</p></div>
      {!!changes.length && <input type="search" className="table-search" placeholder="Search by name or resident number..." aria-label="Search the residency change history" value={search} onChange={event => setSearch(event.target.value)} />}
    </div>
    {!changes.length ? <div className="empty-panel">
      <span className="empty-panel-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h18v13H3z" /><path d="M3 7l2-3h14l2 3" /><path d="M9 12h6" /></svg></span>
      <p className="empty-panel-title">{filter ? 'Nothing in this category yet' : 'No residency changes yet'}</p>
      <p className="empty-panel-note">{filter ? `No resident has been ${filter === 'permanent' ? 'made permanent' : 'reverted to temporary'} so far.` : 'When an administrator makes a temporary resident permanent, the address previously on file is archived here.'}</p>
    </div> : <table className="table-spaced" id="residency-log"><thead><tr>{['Resident', 'Status Now', 'Change Made', 'Address Archived', 'Reason', 'By', 'When'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {changes.map(r => <tr key={r.change_id} data-search-text={`${r.resident_number || ''} ${r.name}`} style={{ display: matches(r) ? undefined : 'none' }}>
        <td>{r.name}{r.resident_number && <><br /><small className="muted-note">{r.resident_number}</small></>}</td>
        <td className="nowrap">{r.residency_status ? <span className={`badge badge-${r.residency_status === 'temporary' ? 'temporary' : 'permanent'}`}>{r.residency_status === 'temporary' ? 'Temporary' : 'Permanent'}</span> : <span className="muted-note">Deleted</span>}</td>
        <td className="nowrap"><span className={`badge badge-${r.to_status === 'permanent' ? 'permanent' : 'temporary'}`}>{titles[r.to_status]}</span><br /><small className="muted-note">{cap(r.from_status)} → {cap(r.to_status)}{Number(r.is_reverted) === 1 && ' · later undone'}</small></td>
        <td>{r.prev_address || <span className="muted-note">None on file</span>}{r.to_status === 'permanent' && r.prev_temporary_address && <><br /><small className="muted-note">Promoted from: {r.prev_temporary_address}</small></>}</td>
        <td>{r.reason || <span className="muted-note">—</span>}</td><td>{r.changed_by_name || <span className="muted-note">System</span>}</td><td className="nowrap">{r.changed_at}</td>
      </tr>)}
      <tr className="no-match-row" style={{ display: changes.some(matches) ? 'none' : undefined }}><td colSpan={7} className="empty-state">No records match your search.</td></tr>
    </tbody></table>}
  </div>
}

if (import.meta.env.DEV) {
  ResidencyLog.propTypes = {
    data: record.isRequired,
  }
}
