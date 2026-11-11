import { Outlet } from 'react-router-dom'
import logo from '../../assets/css/Logo.png'
import Footer from './Footer.jsx'

// Authenticated PHP shells will be ported with session integration.
export default function PlaceholderLayout() {
  return (
    <>
      <div className="plain-topbar no-print">
        <img src={logo} alt="Barangay Health Center Logo" />
        <span className="plain-topbar-text">
          Barangay Health Center
          <small>Survey Management System</small>
        </span>
      </div>
      <div className="app-main">
        <main className="container"><Outlet /></main>
        <Footer />
      </div>
    </>
  )
}
