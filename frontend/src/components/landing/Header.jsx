import { Link } from 'react-router-dom'
import logo from '../../assets/css/Logo.png'

export default function Header() {
  return <header>
    <div className="nav-wrapper">
      <div className="nav-brand reveal" data-delay="0">
        <img src={logo} alt="Barangay Health Center Logo" />
        <span>Barangay Health Center</span>
      </div>
      <nav className="nav-menu">
        <li><Link to="#benefits" className="reveal" data-delay="40">About</Link></li>
        <li><Link to="#features" className="reveal" data-delay="60">Features</Link></li>
        <li><Link to="/login" className="btn-signin reveal" data-delay="80">Sign In</Link></li>
      </nav>
    </div>
  </header>
}
