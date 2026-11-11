import PropTypes from 'prop-types'
import { columns, filters, records } from '../../propTypes.js'
import { useState } from 'react'
import TableSearch from './TableSearch.jsx'
import FilterTabs from './FilterTabs.jsx'

// Rows carry explicit source-derived search text and space-separated filter tokens.
// No sorting or pagination: the PHP always displays the whole filtered list.
export default function DataTable({ id, columns, rows, rowKey = 'id', search = true, filters = [],
  searchId, searchPlaceholder, searchLabel, emptyMessage, title, heading: Heading = 'h2', actions,
  className = 'table-spaced', responsive = false }) {
  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [filtered, setFiltered] = useState(false)
  const needle = term.trim().toLowerCase()
  const matches = rows.map((row) => (!search || (row.searchText || '').toLowerCase().includes(needle)) &&
    (filter === 'all' || (row.filter || '').split(' ').includes(filter)))
  const searchBox = search && <TableSearch tableId={id} id={searchId} value={term} onChange={(value) => { setTerm(value); setFiltered(true) }}
    placeholder={searchPlaceholder} label={searchLabel} />
  const table = <table id={id} className={className}>
    <thead><tr>{columns.map(({ key, label, headerProps }) => <th key={key} {...headerProps}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row[rowKey]} className={row.className}
      data-search-text={row.searchText || ''} data-filter={row.filter} style={{ display: matches[index] ? '' : 'none' }}>
      {columns.map(({ key, render, cellProps }) => <td key={key} {...cellProps}>{render ? render(row) : row[key]}</td>)}
    </tr>)}
    {emptyMessage && <tr className="no-match-row" style={{ display: !filtered || matches.some(Boolean) ? 'none' : '' }}><td colSpan={columns.length}>{emptyMessage}</td></tr>}</tbody>
  </table>
  return <>
    {title && <div className="card-head"><Heading className="card-head-title">{title}</Heading>{filters.length === 0 && searchBox}{actions}</div>}
    {(filters.length > 0 || (!title && search)) && <div className="table-toolbar">
      {searchBox}{filters.length > 0 && <FilterTabs tableId={id} filters={filters} value={filter} onChange={(value) => { setFilter(value); setFiltered(true) }} />}
    </div>}
    {responsive ? <div className="table-responsive">{table}</div> : table}
  </>
}

if (import.meta.env.DEV) {
  DataTable.propTypes = {
    id: PropTypes.string,
    columns: columns.isRequired,
    rows: records.isRequired,
    rowKey: PropTypes.string,
    search: PropTypes.bool,
    filters: filters,
    searchId: PropTypes.string,
    searchPlaceholder: PropTypes.string,
    searchLabel: PropTypes.string,
    emptyMessage: PropTypes.node,
    title: PropTypes.node,
    heading: PropTypes.elementType,
    actions: PropTypes.node,
    className: PropTypes.string,
    responsive: PropTypes.bool,
  }
}
