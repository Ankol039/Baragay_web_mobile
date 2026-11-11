import PropTypes from 'prop-types'
import { filters } from '../../propTypes.js'
export default function FilterTabs({ tableId, filters, value, onChange }) {
  return <div className="filter-tabs">{filters.map(({ value: filter, label }) =>
    <button key={filter} type="button" className={`filter-tab${value === filter ? ' active' : ''}`}
      data-filter-group={tableId} data-filter={filter} aria-pressed={value === filter} onClick={() => onChange(filter)}>{label}</button>)}</div>
}

if (import.meta.env.DEV) {
  FilterTabs.propTypes = {
    tableId: PropTypes.string.isRequired,
    filters: filters.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
  }
}
