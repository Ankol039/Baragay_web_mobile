import PropTypes from 'prop-types'
import { records } from '../../propTypes.js'
export default function ResultBars({ rows, rating = false }) {
  return <div style={{ maxWidth: 700 }}>{rows.map((row, index) => <div className="bar-row" style={{ marginBottom: rating ? 12 : 14 }} key={index}>
    <div className="bar-label" style={{ width: rating ? 100 : 200, fontWeight: 600 }}>
      {rating ? `${row.rating_value} Star${row.rating_value > 1 ? 's' : ''}` : row.choice_text}
    </div>
    <div className="bar-track" style={{ height: rating ? 20 : 24 }}><div className="bar-fill" style={{ width: `${row.percent}%`, backgroundColor: row.winning ? 'var(--accent)' : 'var(--primary)', transition: 'width 0.5s ease' }} /></div>
    <div className="bar-value" style={{ width: 80, textAlign: 'left', paddingLeft: 10, fontWeight: 600 }}>{`${row.percent}% `}
      <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 400 }}>{`(${row.votes})`}</span>
    </div>
  </div>)}</div>
}

if (import.meta.env.DEV) {
  ResultBars.propTypes = {
    rows: records.isRequired,
    rating: PropTypes.bool,
  }
}
