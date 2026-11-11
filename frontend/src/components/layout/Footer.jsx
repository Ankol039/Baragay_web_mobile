import { useState } from 'react'

export default function Footer() {
  const [year] = useState(() => new Date().getFullYear())
  return <footer className="site-footer no-print">&copy; {year} Barangay Health Center &mdash; Survey Management System</footer>
}
