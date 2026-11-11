import PropTypes from 'prop-types'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'
import Icon from '../common/Icon.jsx'

export default function LogoutLink({ className }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function signOut(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await logout()
      navigate(result.redirect, { replace: true })
    } catch (failure) {
      setError(failure.message)
    } finally {
      setPending(false)
    }
  }
  return <>
    <a href="#logout" className={className} onClick={signOut} aria-label="Logout" aria-disabled={pending}><Icon name="logout" /><span>Logout</span></a>
    {error && <span className="alert alert-error" role="alert">{error}</span>}
  </>
}

if (import.meta.env.DEV) {
  LogoutLink.propTypes = {
    className: PropTypes.string,
  }
}
