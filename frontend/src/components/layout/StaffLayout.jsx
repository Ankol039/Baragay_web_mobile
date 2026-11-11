import PortalLayout from './PortalLayout.jsx'

export default function StaffLayout(props) {
  return <PortalLayout {...props} />
}

if (import.meta.env.DEV) StaffLayout.propTypes = PortalLayout.propTypes
