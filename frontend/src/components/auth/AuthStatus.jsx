import useAuth from '../../hooks/useAuth.js'

export default function AuthStatus() {
  const { error, refresh } = useAuth()
  return (
    <div className="container" aria-live="polite">
      {error ? <div className="alert alert-error" role="alert">{error} <button type="button" onClick={() => refresh()}>Try Again</button></div>
        : <p role="status">Loading…</p>}
    </div>
  )
}
