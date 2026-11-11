import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
const tests = {
  length: (value) => value.length >= 8,
  upper: (value) => /[A-Z]/.test(value),
  lower: (value) => /[a-z]/.test(value),
  number: (value) => /[0-9]/.test(value),
  space: (value) => value.length > 0 && !/\s/.test(value),
}

export default function PasswordRules({ rules, value }) {
  return (
    <div className="password-rules" id="password-rules">
      <span className="password-rules-title">Your password must have:</span>
      <ul>{rules.map(({ key, label }) => (
        <li key={key} data-rule={key} className={value.length > 0 && tests[key]?.(value) ? 'rule-met' : ''}>
          <span className="rule-mark" aria-hidden="true" /><span className="rule-text">{label}</span>
        </li>
      ))}</ul>
      <small className="field-hint">Tip: a symbol such as ! or # makes it stronger, but is not required.</small>
    </div>
  )
}

if (import.meta.env.DEV) {
  PasswordRules.propTypes = {
    rules: records.isRequired,
    value: PropTypes.string.isRequired,
  }
}
