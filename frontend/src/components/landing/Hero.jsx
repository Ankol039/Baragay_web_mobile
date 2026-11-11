import LandingIcon from './LandingIcon.jsx'
import { heroStats } from './landingData.js'

export default function Hero() {
  return <section className="hero">
    <div className="hero-wrapper">
      <div className="hero-content reveal" data-delay="80">
        <h1>Your Health Records, Simplified</h1>
        <p>Access and update your personal and family health information securely. Manage documents, track surveys, and stay connected with your barangay health center—all from home.</p>
        <div className="hero-stats">
          {heroStats.map(({ number, label }) => <div key={label} className="stat-item">
            <span className="stat-number">{number}</span>
            <span className="stat-label">{label}</span>
          </div>)}
        </div>
      </div>
      <div className="hero-visual reveal" data-delay="120">
        <div className="hero-icon"><LandingIcon name="records" size={48} /></div>
        <h3>Smart Records Management</h3>
        <p>Digital health profiles for you and your family, verified by our health staff.</p>
      </div>
    </div>
  </section>
}
