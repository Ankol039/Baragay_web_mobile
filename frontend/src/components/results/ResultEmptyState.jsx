import PropTypes from 'prop-types'
import Card from '../common/Card.jsx'
import EmptyState from '../common/EmptyState.jsx'

export default function ResultEmptyState({ report = false }) {
  const icon = <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {report ? <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 15h6M9 11h3" /></>
      : <><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /><line x1="3" x2="21" y1="21" y2="21" /></>}
  </svg>
  return <Card className={report ? 'no-print' : ''}><EmptyState title={report ? 'No Report Selected' : 'No Result Selected'} icon={icon}>
    {report ? 'Choose a survey from the dropdown above to generate its printable report.' : 'Pick a survey from the dropdown above to view its response breakdown and charts.'}
  </EmptyState></Card>
}

if (import.meta.env.DEV) {
  ResultEmptyState.propTypes = {
    report: PropTypes.bool,
  }
}
