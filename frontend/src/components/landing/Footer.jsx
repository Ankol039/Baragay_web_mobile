import logo from '../../assets/css/Logo.png'
import { Link } from 'react-router-dom'
import { footerGroups } from './landingData.js'

export default function Footer() {
  return <footer>
    <div className="footer-wrapper">
      <div className="footer-brand">
        <img src={logo} alt="Barangay Health Center Logo"
          style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
        <div>
          <strong>Barangay Health Center</strong>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.78)', marginTop: 6 }}>Modern resident information management</div>
        </div>
      </div>
      {footerGroups.map(({ title, links }) => <div key={title} className="footer-col">
        <h5>{title}</h5>
        <ul>{links.map(({ href, label }) => <li key={href}><Link to={href}>{label}</Link></li>)}</ul>
      </div>)}
      <div className="footer-bottom">
        <p>&copy; 2026 Barangay Health Center Survey System. Serving your community with care.</p>
      </div>
    </div>
  </footer>
}
