import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import { authDestination } from '../../routes/authRedirect.js'
import detectAccountType from '../../utils/detectAccountType.js'
import AuthStatus from '../../components/auth/AuthStatus.jsx'
import AuthBrandPanel from '../../components/auth/AuthBrandPanel.jsx'
import PasswordField from '../../components/auth/PasswordField.jsx'

export default function Login() {
  usePageTitle('Sign In')
  const auth = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      const normalised = detectAccountType(identifier)
      const result = await auth.login({ identifier: normalised.identifier, password })
      navigate(authDestination(result.data.user), { replace: true })
    } catch (failure) {
      setError(failure.message)
      setPassword('') // PHP never re-renders a submitted password.
    } finally {
      setPending(false)
    }
  }

  if (auth.loading || auth.error) return <AuthStatus />
  if (auth.user) return <Navigate to={authDestination(auth.user)} replace />

  return (
    <div className="auth-wrapper"><div className="auth-split">
      <AuthBrandPanel />
      <div className="auth-form-panel">
        <h2>Sign in</h2>
        <p className="auth-form-hint">Enter your Resident Number, Staff Number or username.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form noValidate onSubmit={submit} aria-busy={pending}>
          <label htmlFor="identifier">Resident No. / Staff No. / Username <span className="req">*</span></label>
          <input type="text" id="identifier" name="identifier" placeholder="e.g. R-2026-0001, S-2026-0001 or admin"
            value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoFocus autoComplete="username" />
          <label htmlFor="password">Password <span className="req">*</span></label>
          <PasswordField id="password" placeholder="Enter your password" required autoComplete="current-password"
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <button type="submit" className="btn-block" disabled={pending}>Log In</button>
        </form>
        <p className="auth-recovery">Forgot your password? Visit the Barangay Health Center and ask staff to
          reset it. Residents bring a valid ID; staff accounts are reset by the administrator.</p>
        <p className="auth-footnote">Residents use the Resident Number issued by the health center. Staff use their
          Staff Number or username assigned by the administrator. New accounts start with a temporary
          password and are prompted to set their own on first login.</p>
      </div>
    </div></div>
  )
}
