import logo from '../../assets/css/Logo.png'

export default function AuthBrandPanel() {
  return (
    <div className="auth-brand">
      <img className="auth-brand-logo" src={logo} alt="Barangay Health Center Logo" />
      <p className="auth-brand-tagline">Resident &amp; Staff Portal</p>
      <h1>Barangay Health Center Survey System</h1>
      <p>A web-based survey platform for the Barangay Health Center. Residents can
        answer surveys while authorised staff can manage residents, surveys, and results.</p>
      <ul className="auth-points">
        <li>One login for residents and health center personnel</li>
        <li>Your account type is detected automatically</li>
        <li>Works across desktop, tablet, and mobile devices</li>
      </ul>
    </div>
  )
}
