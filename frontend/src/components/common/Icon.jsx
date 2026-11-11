import PropTypes from 'prop-types'
// SVG geometry and names copied from includes/icons.php.
const icons = {
  'dashboard': (<><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/></>),
  'surveys': (<><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 11h6M9 15h6M9 19h3"/></>),
  'residents': (<><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  'results': (<><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></>),
  'statistics': (<><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></>),
  'reports': (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 11h2"/></>),
  'staff': (<><path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5Z"/><path d="m9 12 2 2 4-4"/></>),
  'logout': (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></>),
  'profile': (<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></>),
  'password': (<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
  'edit': (<><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></>),
  'search': (<><circle cx="11" cy="11" r="7"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></>),
  'lock': (<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
  'power': (<><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" x2="12" y1="2" y2="12"/></>),
  'chevron': (<><polyline points="6 9 12 15 18 9"/></>),
  'clock': (<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>),
  'check': (<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
  'trash': (<><polyline points="3 6 5 6 21 6"/><path d="M8 6V4h8v2M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/></>),
  'switch': (<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>),
  'eye': (<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>),
  'download': (<><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>),
  'chevron-left': (<><polyline points="15 18 9 12 15 6"/></>),
}

export default function Icon({ name, width = 18, height = 18, className }) {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {Object.hasOwn(icons, name) ? icons[name] : <circle cx="12" cy="12" r="9" />}
    </svg>
  )
}

if (import.meta.env.DEV) {
  Icon.propTypes = {
    name: PropTypes.string.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    className: PropTypes.string,
  }
}
