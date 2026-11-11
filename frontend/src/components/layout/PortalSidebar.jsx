import PropTypes from 'prop-types'
import { user } from '../../propTypes.js'
import { NavLink } from 'react-router-dom'
import Icon from '../common/Icon.jsx'
import logo from '../../assets/css/Logo.png'

const residentLinks = [
  ['dashboard', 'dashboard', 'Dashboard'], ['surveys', 'surveys', 'Available Surveys'],
  ['history', 'reports', 'Submitted Surveys'], ['profile', 'profile', 'My Profile'], ['change-password', 'password', 'Change Password'],
]
const staffLinks = [
  ['dashboard', 'dashboard', 'Dashboard'], ['Surveys'], ['survey-management', 'surveys', 'Surveys'],
  ['results-dashboard', 'results', 'Results'], ['reports', 'reports', 'Reports'], ['People'],
  ['resident-management', 'residents', 'Registered Resident'], ['address-requests', 'residents', 'Address Requests'],
  ['user-management', 'staff', 'User Management'], ['deletion-requests', 'trash', 'Deletion Requests', 'pending_deletions'],
]

export default function PortalSidebar({ user, open, onClose, activePath }) {
  const resident = user.account_type === 'resident'
  const links = resident ? residentLinks : [...staffLinks, ...(user.role === 'admin' ? [
    ['residency-records', 'clock', 'Residency Records'], ['deleted-accounts', 'switch', 'Deleted Accounts', 'archived_accounts'],
  ] : [])]
  return <>
    <aside className={`sidebar no-print${open ? ' mobile-open' : ''}`} id="app-sidebar">
      <button type="button" className="sidebar-close mobile-nav-close" aria-label="Close navigation" title="Close navigation" onClick={() => onClose(true)}>&times;</button>
      <div className="sidebar-header">
        <div className="sidebar-logo"><img className="sidebar-logo-img" src={logo} alt="Barangay Health Center Logo" />
          <span className="sidebar-logo-text">Barangay Health Center<small>Survey Management System</small></span>
        </div>
        {resident && user.residency_status && <span className={`sidebar-role${user.residency_status === 'temporary' ? ' sidebar-role-temporary' : ''}`}>
          {user.residency_status === 'temporary' ? 'Temporary' : 'Permanent'} Resident
        </span>}
        {resident && user.residency_status === 'temporary' && user.residence_type_label && <span className="sidebar-residence-type" title={`${user.residence_type} — ${user.residence_type_label}`}>
          {`${user.residence_type} · ${user.residence_type_label}`}
        </span>}
      </div>
      <nav>{links.map(([path, icon, label, count]) => icon ? (
        <NavLink end key={path} to={`/${user.account_type}/${path}`} className={({ isActive }) => `nav-item${(activePath ? path === activePath : isActive) ? ' active' : ''}`} onClick={onClose}>
          <Icon name={icon} /><span>{label}</span>{user.role === 'admin' && user[count] > 0 && <span className="nav-count">{user[count]}</span>}
        </NavLink>
      ) : <span key={path} className="sidebar-section-label">{path}</span>)}</nav>
    </aside>
    <div className={`nav-drawer-backdrop${open ? ' active' : ''}`} id="nav-drawer-backdrop" aria-hidden={!open} onClick={onClose} />
  </>
}

if (import.meta.env.DEV) {
  PortalSidebar.propTypes = {
    user: user.isRequired,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func,
    activePath: PropTypes.string,
  }
}
