import PropTypes from 'prop-types'
export default function PageHead({ title, subtitle, children, actions, className = '' }) {
  return <div className={`page-head${className ? ` ${className}` : ''}`}>
    <div className="page-head-text">{children}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {actions && <div className="page-head-actions">{actions}</div>}
  </div>
}

if (import.meta.env.DEV) {
  PageHead.propTypes = {
    title: PropTypes.node,
    subtitle: PropTypes.node,
    children: PropTypes.node,
    actions: PropTypes.node,
    className: PropTypes.string,
  }
}
