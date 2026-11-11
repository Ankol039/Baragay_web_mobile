import PropTypes from 'prop-types'
export default function PageActionsRow({ children, className = '', ...props }) {
  return <div {...props} className={`page-actions-row${className ? ` ${className}` : ''}`}>{children}</div>
}

if (import.meta.env.DEV) {
  PageActionsRow.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  }
}
