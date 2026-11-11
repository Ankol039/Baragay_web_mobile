import { checklistItems } from './landingData.js'
import LandingIcon from './LandingIcon.jsx'

export default function BenefitsChecklist() {
  return <section id="benefits" className="checklist-section">
    <div className="section-wrapper">
      <div className="section-header">
        <div className="section-label">Why Choose This System</div>
        <h2 className="section-title">Built for Convenience & Security</h2>
      </div>
      <div className="checklist-grid">
        <div className="checklist-items">
          {checklistItems.map(({ title, description, delay }) => (
            <div key={title} className="checklist-item reveal" data-delay={delay}>
              <div className="check-icon">
                <LandingIcon name="check" size={20} strokeWidth={2} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="check-content"><h4>{title}</h4><p>{description}</p></div>
            </div>
          ))}
        </div>
        <div className="checklist-visual reveal" data-delay="320">
          <div className="checklist-visual-icon"><LandingIcon name="secure" size={56} /></div>
          <p><strong>Encrypted & Protected</strong></p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.95rem', lineHeight: 1.6 }}>Your data is stored securely and complies with health regulations.</p>
        </div>
      </div>
    </div>
  </section>
}
