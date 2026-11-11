import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import usePageTitle from '../hooks/usePageTitle.js'
import PasswordField from '../components/auth/PasswordField.jsx'
import PasswordRules from '../components/auth/PasswordRules.jsx'
import PasswordMatchHint from '../components/auth/PasswordMatchHint.jsx'
import PasswordSuccessModal from '../components/auth/PasswordSuccessModal.jsx'

const empty = { current_password: '', new_password: '', confirm_password: '' }

export default function ChangePassword() {
  usePageTitle('Change Password')
  const { user, passwordRules, changePassword } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState(empty)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [pending, setPending] = useState(false)
  const staff = user.account_type === 'staff'
  const first = user.is_first_login
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await changePassword(values)
      setValues(empty)
      if (result.ui?.modal) setSuccess(result)
      else navigate(result.redirect, { replace: true })
    } catch (failure) {
      setError(failure.message)
      setValues(empty)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="page-head"><div className="page-head-text">
        <h1>{staff && first ? 'Set Your Password' : 'Change Password'}</h1>
        <p>{staff && first ? 'Step 1 of 2. Replace the temporary password before you use the system.'
          : `Choose a new password for your ${staff ? 'staff' : 'resident'} account.`}</p>
      </div></div>
      <div className="card card-form">
        {first && <div className="alert alert-info">{staff ? <>
          {`This is your first login. Your current password is your Staff Number${user.staff_number ? ' (' : ' '}`}
          {user.staff_number && <strong>{user.staff_number}</strong>}
          {`${user.staff_number ? ')' : ''}. Set a password only you know — nobody at the health center can see it once you do.`}
        </> : <>This is your first login. Please set a new password before continuing.
          Your current password is your Resident Number.</>}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={submit} aria-busy={pending}>
          <label htmlFor="current_password">Current Password <span className="req">*</span></label>
          <PasswordField id="current_password" required autoComplete="current-password" value={values.current_password} onChange={update} />
          <label htmlFor="new_password">New Password <span className="req">*</span></label>
          <PasswordField id="new_password" required minLength={8} autoComplete="new-password" aria-describedby="password-rules" value={values.new_password} onChange={update} />
          <PasswordRules rules={passwordRules} value={values.new_password} />
          <label htmlFor="confirm_password">Confirm New Password <span className="req">*</span></label>
          <PasswordField id="confirm_password" required minLength={8} autoComplete="new-password" value={values.confirm_password} onChange={update} />
          <PasswordMatchHint password={values.new_password} confirmation={values.confirm_password} />
          <button type="submit" className="btn-wide" disabled={pending}>{staff && first ? 'Set Password' : 'Update Password'}</button>
        </form>
      </div>
      {success && <PasswordSuccessModal message={success.message} portal={user.account_type} onClose={() => setSuccess(null)} />}
    </>
  )
}
