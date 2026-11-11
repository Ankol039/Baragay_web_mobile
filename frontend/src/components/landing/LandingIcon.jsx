import PropTypes from 'prop-types'
import { record } from '../../propTypes.js'
// Landing-specific SVG geometry copied from landing.php.
const icons = {
  records: (<><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/></>),
  check: (<><path d="M20 6L9 17l-5-5"/></>),
  secure: (<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>),
  person: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  recordsChart: (<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>),
  survey: (<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v6H8V2"/></>),
  household: (<><path d="M3 9.5L12 3l9 6.5"/><path d="M9 22V12h6v10"/></>),
  mobile: (<><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>),
  instant: (<><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></>),
}

export default function LandingIcon({ name, size, strokeWidth = 1.8, style }) {
  return <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} style={style}>
    {icons[name]}
  </svg>
}

if (import.meta.env.DEV) {
  LandingIcon.propTypes = {
    name: PropTypes.string.isRequired,
    size: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number,
    style: record,
  }
}
