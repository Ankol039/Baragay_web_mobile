const linkStyle = { color: 'var(--primary)' }
const paragraphStyle = { color: 'var(--text-muted)', marginTop: '0.75rem', maxWidth: '720px' }
const sections = [
  {
    id: 'about', delay: 620, title: 'About Us',
    content: 'We are a community-focused team building simple, secure tools for barangay health centers. Our system helps staff manage resident records, run surveys, and provide timely care. We partner with local health workers to keep data accurate and respect patient privacy.',
  },
  {
    id: 'careers', delay: 660, title: 'Careers',
    content: <>We're a small, growing team. Open roles: Frontend Developer, Community Coordinator, and Support Specialist. If you're passionate about public health tech, email us at <a href="mailto:jobs@barangayhealth.example" style={linkStyle}>jobs@barangayhealth.example</a> with your resume.</>,
  },
  {
    id: 'contact', delay: 700, title: 'Contact Us',
    content: <>For general inquiries, call <a href="tel:+63255550123" style={linkStyle}>+63 2 5555 0123</a> or email <a href="mailto:info@barangayhealth.example" style={linkStyle}>info@barangayhealth.example</a>. You can also visit your local barangay health center during working hours.</>,
  },
]

export default function AboutSection() {
  return <>{sections.map(({ id, delay, title, content }) => (
    <section key={id} id={id} className="section">
      <div className="section-wrapper">
        <div className="section-header reveal" data-delay={delay}>
          <h2 className="section-title">{title}</h2>
          <p style={paragraphStyle}>{content}</p>
        </div>
      </div>
    </section>
  ))}</>
}
