import { features } from './landingData.js'
import LandingIcon from './LandingIcon.jsx'

export default function FeatureCards() {
  return (
    <section id="features" className="features-section">
      <div className="section-wrapper">
        <div className="section-header">
          <div className="section-label">Capabilities</div>
          <h2 className="section-title">Everything You Need</h2>
        </div>
        <div className="card-grid">
          {features.map(({ title, description, icon, delay }) => (
            <div key={title} className="card reveal" data-delay={delay}>
              <div className="card-icon"><LandingIcon name={icon} size={38} style={{ color: 'var(--primary)' }} /></div>
              <h3>{title}</h3><p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
