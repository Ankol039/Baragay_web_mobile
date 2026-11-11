import PropTypes from 'prop-types'
import { user } from '../../propTypes.js'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'
import logo from '../../assets/css/Logo.png'
import LogoutLink from '../auth/LogoutLink.jsx'
import PortalSidebar from './PortalSidebar.jsx'
import Topbar from './Topbar.jsx'
import Footer from './Footer.jsx'

export default function PortalLayout({ user: suppliedUser, children, activePath }) {
  const auth = useAuth()
  const user = suppliedUser || auth.user
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  // The password/profile pages override header visibility independently in PHP.
  const showSidebar = user.account_type === 'resident' || pathname === '/staff/change-password'
    ? !user.is_first_login
    : pathname === '/staff/complete-profile' ? user.role === 'admin' || user.profile_completed || profileSaved : user.show_sidebar
  const plain = user.account_type === 'resident' && !showSidebar
  useEffect(() => {
    document.body.classList.toggle('portal-layout', showSidebar)
    return () => document.body.classList.remove('portal-layout')
  }, [showSidebar])
  useEffect(() => {
    document.body.classList.toggle('nav-open', open)
    const escape = (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        document.getElementById('mobile-nav-toggle')?.focus()
      }
    }
    const resize = () => { if (window.innerWidth > 1100) setOpen(false) }
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', resize)
    return () => {
      document.body.classList.remove('nav-open')
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', resize)
    }
  }, [open])
  return <>
    {showSidebar && <PortalSidebar user={user} open={open} activePath={activePath} onClose={(focus) => {
      setOpen(false)
      if (focus === true) document.getElementById('mobile-nav-toggle')?.focus()
    }} />}
    {plain && <div className="plain-topbar no-print">
      <img src={logo} alt="Barangay Health Center Logo" />
      <span className="plain-topbar-text">Barangay Health Center<small>Survey Management System</small></span>
      <LogoutLink className="plain-topbar-logout" />
    </div>}
    <div className="app-main">
      {!plain && <Topbar user={user} open={open} showSidebar={showSidebar} onToggle={() => setOpen(!open)} />}
      <div className="container">{children || <Outlet context={{ setProfileSaved }} />}</div>
      <Footer />
    </div>
  </>
}

if (import.meta.env.DEV) {
  PortalLayout.propTypes = {
    user: user,
    children: PropTypes.node,
    activePath: PropTypes.string,
  }
}
