import PropTypes from 'prop-types'
export default function ChartCard({ id, title, note, meta, filter, className = '', bodyClassName = '', children }) {
  return <div id={id} className={`db-panel${className ? ` ${className}` : ''}`}>
    <div className="db-panel-head">
      <div><h3 className="db-panel-title">{title}</h3>{note && <p className="db-panel-note">{note}</p>}</div>
      {meta}
    </div>
    {filter}
    <div className={`db-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
  </div>
}

// The PHP leaves these canvases undrawn until its AJAX request succeeds.
export function ChartPlaceholder({ id, label, className = 'db-chart-md' }) {
  return <div className={`db-chart ${className}`}><canvas id={id} role="img" aria-label={label} /></div>
}

if (import.meta.env.DEV) {
  ChartCard.propTypes = {
    id: PropTypes.string,
    title: PropTypes.node,
    note: PropTypes.node,
    meta: PropTypes.node,
    filter: PropTypes.node,
    className: PropTypes.string,
    bodyClassName: PropTypes.string,
    children: PropTypes.node,
  }
  ChartPlaceholder.propTypes = {
    id: PropTypes.string,
    label: PropTypes.node,
    className: PropTypes.string,
  }
}
