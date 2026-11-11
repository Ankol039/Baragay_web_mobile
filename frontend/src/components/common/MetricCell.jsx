import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

export default function MetricCell({ label, value, foot, to, small = false }) {
  const content = <>
    <span className="db-cell-label">{label}</span><span className={`db-cell-value${small ? ' db-value-sm' : ''}`}>{value}</span><span className="db-cell-foot">{foot}</span>
  </>
  return to ? <Link className="db-cell" to={to}>{content}</Link> : <span className="db-cell">{content}</span>
}

if (import.meta.env.DEV) {
  MetricCell.propTypes = {
    label: PropTypes.node,
    value: PropTypes.node.isRequired,
    foot: PropTypes.node.isRequired,
    to: PropTypes.string,
    small: PropTypes.bool,
  }
}
