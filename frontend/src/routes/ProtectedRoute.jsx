import PropTypes from 'prop-types'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import AuthStatus from '../components/auth/AuthStatus.jsx'
import { protectedDestination } from './authRedirect.js'

export default function ProtectedRoute({ portal }) {
  const { user, loading, error } = useAuth()
  const { pathname } = useLocation()
  if (loading || error) return <AuthStatus />
  const redirect = protectedDestination(user, portal, pathname)
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />
}

export function AdminRoute() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <Outlet /> : (
    <div className="card"><div className="alert alert-error" role="alert">Access denied. Only Admin accounts can manage staff accounts.</div></div>
  )
}


if (import.meta.env.DEV) {
  ProtectedRoute.propTypes = {
    portal: PropTypes.oneOf(['resident', 'staff']).isRequired,
  }
}
