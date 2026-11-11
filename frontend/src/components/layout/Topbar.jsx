import PropTypes from 'prop-types'
import { user } from '../../propTypes.js'
import logo from '../../assets/css/Logo.png'
import AccountMenu from './AccountMenu.jsx'

export default function Topbar({ user, open, onToggle, showSidebar = true }) {
  return <div className="app-topbar no-print">
    <button type="button" className="mobile-nav-toggle mobile-nav-trigger" id="mobile-nav-toggle"
      aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}
      aria-controls={showSidebar ? 'app-sidebar' : undefined} onClick={showSidebar ? onToggle : undefined}>☰</button>
    <div className="mobile-brand" aria-hidden="true"><img src={logo} alt="" /><span>Barangay Health Center<small>Survey Management System</small></span></div>
    <AccountMenu user={user} />
  </div>
}

if (import.meta.env.DEV) {
  Topbar.propTypes = {
    user: user.isRequired,
    open: PropTypes.bool.isRequired,
    onToggle: PropTypes.func,
    showSidebar: PropTypes.bool,
  }
}
