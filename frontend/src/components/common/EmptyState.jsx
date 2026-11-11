import PropTypes from 'prop-types'
export default function EmptyState({ title, icon, children, className = '' }) {
  return <div className={`${title ? 'empty-panel' : 'empty-state'}${className ? ` ${className}` : ''}`}>
    {icon && <span className="empty-panel-icon">{icon}</span>}
    {title && <h3>{title}</h3>}{title ? <p>{children}</p> : children}
  </div>
}

if (import.meta.env.DEV) {
  EmptyState.propTypes = {
    title: PropTypes.node,
    icon: PropTypes.node,
    children: PropTypes.node,
    className: PropTypes.string,
  }
}
