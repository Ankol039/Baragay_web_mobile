import PropTypes from 'prop-types'
export default function Card({ title, actions, heading: Heading = 'h2', children, className = '', ...props }) {
  return <div {...props} className={`card${className ? ` ${className}` : ''}`}>
    {(title || actions) && <div className="card-head">
      {title && <Heading className="card-head-title">{title}</Heading>}{actions}
    </div>}
    {children}
  </div>
}

if (import.meta.env.DEV) {
  Card.propTypes = {
    title: PropTypes.node,
    actions: PropTypes.node,
    heading: PropTypes.elementType,
    children: PropTypes.node,
    className: PropTypes.string,
  }
}
