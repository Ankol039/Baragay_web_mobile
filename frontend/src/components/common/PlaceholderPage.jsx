import PropTypes from 'prop-types'
import Icon from './Icon.jsx'
import usePageTitle from '../../hooks/usePageTitle.js'

export default function PlaceholderPage({ title, documentTitle = title, source, icon = 'dashboard' }) {
  usePageTitle(documentTitle)
  return (
    <>
      <div className="page-head">
        <div className="page-head-text"><h1>{title}</h1></div>
      </div>
      <section className="card" aria-label="Page placeholder">
        <h2><Icon name={icon} /> Placeholder</h2>
        <p>This page is awaiting migration.</p>
        {source && <p><code>{source}</code></p>}
      </section>
    </>
  )
}

if (import.meta.env.DEV) {
  PlaceholderPage.propTypes = {
    title: PropTypes.node,
    documentTitle: PropTypes.string,
    source: PropTypes.string,
    icon: PropTypes.node,
  }
}
