import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
export default function ResidencySwitch({ resident, canManage, onSwitch }) {
  const temporary = resident.residency_status === 'temporary'
  const hasTemp = !!(resident.temp_household_number || resident.temporary_address)
  return <div>
    <label>Residency Status</label>
    <p className="field-static" id="edit-residency-display"><span className={`badge badge-${temporary ? 'temporary' : 'permanent'}`} id="edit-residency-badge">{temporary ? 'Temporary' : 'Permanent'}</span></p>
    {canManage ? <div className="residency-switch" id="residency-switch">
      <p className="residency-switch-note" id="residency-switch-note">{!temporary
        ? 'Currently Permanent. Reverting restores the address archived when they were made permanent.'
        : hasTemp ? 'Currently Temporary. Their temporary address becomes their permanent one, and the current address is archived.'
          : 'Currently Temporary. Add a temporary address first - there is nothing to promote.'}</p>
      <button type="button" className="btn btn-secondary btn-small" id="residency-switch-btn" disabled={temporary && !hasTemp} onClick={onSwitch}>
        {temporary ? 'Make Permanent Resident' : 'Revert to Temporary Resident'}</button>
    </div> : <small className="field-hint">Only an administrator can move a resident between temporary and permanent.</small>}
  </div>
}

if (import.meta.env.DEV) {
  ResidencySwitch.propTypes = {
    resident: record.isRequired,
    canManage: PropTypes.bool.isRequired,
    onSwitch: PropTypes.func,
  }
}
