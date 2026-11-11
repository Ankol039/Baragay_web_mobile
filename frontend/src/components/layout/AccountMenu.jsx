import { user } from '../../propTypes.js'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../common/Icon.jsx'
import LogoutLink from '../auth/LogoutLink.jsx'

export default function AccountMenu({ user }) {
  const [open, setOpen] = useState(false)
  const [failedPhoto, setFailedPhoto] = useState(null)
  const container = useRef(null)
  const profile = user.account_type === 'staff' ? 'complete-profile' : 'profile'
  useEffect(() => {
    const outside = (event) => { if (!container.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('click', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('click', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <div className="account-tab" ref={container}>
      <button type="button" className="account-chip" id="account-chip" title={user.display_name}
        aria-expanded={open} aria-haspopup="true" aria-controls="account-menu" onClick={() => setOpen(!open)}>
        {user.photo && failedPhoto !== user.photo ? <img className="account-avatar" src={user.photo.startsWith('data:') ? user.photo : `/barangay_survey_system/${user.photo}`} alt="" onError={() => setFailedPhoto(user.photo)} />
          : <span className="account-avatar">{user.initial}</span>}
        <span className="account-meta"><span className="account-name">{user.display_name}</span><span className="account-type">{user.portal_label}</span></span>
        <Icon name="chevron" className="account-caret" width={14} height={14} />
      </button>
      <div className={`account-menu${open ? ' open' : ''}`} id="account-menu">
        <span className="account-menu-name">{user.display_name}</span><span className="account-menu-role">{user.portal_label}</span>
        <div className="account-menu-divider" />
        <Link to={`/${user.account_type}/${profile}`} onClick={() => setOpen(false)}><Icon name="profile" /><span>My Profile</span></Link>
        {user.account_type === 'staff' && <>
          <Link to={`/${user.account_type}/change-password`} onClick={() => setOpen(false)}><Icon name="password" /><span>Change Password</span></Link>
          <div className="account-menu-divider" />
        </>}
        <LogoutLink className="account-menu-danger" />
      </div>
    </div>
  )
}

if (import.meta.env.DEV) {
  AccountMenu.propTypes = {
    user: user.isRequired,
  }
}
