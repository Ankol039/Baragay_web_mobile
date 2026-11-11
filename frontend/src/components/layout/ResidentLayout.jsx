import PortalLayout from './PortalLayout.jsx'

export default function ResidentLayout(props) {
  return <PortalLayout {...props} />
}

if (import.meta.env.DEV) ResidentLayout.propTypes = PortalLayout.propTypes
