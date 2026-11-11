import PropTypes from 'prop-types'
export default function PasswordMatchHint({ password, confirmation }) {
  const matching = confirmation === password
  return (
    <small className={`field-hint match-hint${confirmation ? matching ? ' match-ok' : ' match-bad' : ''}`} id="match-hint" aria-live="polite">
      {confirmation && (matching ? 'Passwords match.' : 'Passwords do not match yet.')}
    </small>
  )
}

if (import.meta.env.DEV) {
  PasswordMatchHint.propTypes = {
    password: PropTypes.string.isRequired,
    confirmation: PropTypes.string.isRequired,
  }
}
