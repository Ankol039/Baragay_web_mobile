import PropTypes from 'prop-types'
import { useState } from 'react'

export default function PasswordField({ id, name = id, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="password-field">
      <input {...props} id={id} name={name} type={visible ? 'text' : 'password'} />
      <button type="button" className={`password-toggle${visible ? ' is-visible' : ''}`} data-target={id}
        aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
        <svg className="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" />
        </svg>
        <svg className="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" x2="23" y1="1" y2="23" />
        </svg>
      </button>
    </span>
  )
}

if (import.meta.env.DEV) {
  PasswordField.propTypes = {
    id: PropTypes.string,
    name: PropTypes.string,
  }
}
