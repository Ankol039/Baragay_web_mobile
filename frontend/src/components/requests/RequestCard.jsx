import PropTypes from 'prop-types'
export default function RequestCard({ title, count, pending = 0, children }) {
  return <div className="card">
    <div className="card-head"><h3 className="card-head-title">{`${title} (${count})`}</h3>
      {pending > 0 && <span className="badge badge-pending">{`${pending} pending`}</span>}
    </div>
    {children}
  </div>
}
export function RequestStatus({ status }) {
  return <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

if (import.meta.env.DEV) {
  RequestCard.propTypes = {
    title: PropTypes.node,
    count: PropTypes.number.isRequired,
    pending: PropTypes.number,
    children: PropTypes.node,
  }
  RequestStatus.propTypes = {
    status: PropTypes.string.isRequired,
  }
}
