import PropTypes from 'prop-types'
import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

export default function TableSearch({ tableId, id = `${tableId}-search`, value, onChange, placeholder, label }) {
  const input = useRef(null)
  useEffect(() => {
    const node = input.current
    const search = () => onChange(node.value)
    node.addEventListener('search', search)
    return () => node.removeEventListener('search', search)
  }, [onChange])
  return <div className="search-field"><Icon name="search" />
    <input ref={input} type="search" id={id} data-table-search={tableId} placeholder={placeholder} aria-label={label}
      value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
}

if (import.meta.env.DEV) {
  TableSearch.propTypes = {
    tableId: PropTypes.string.isRequired,
    id: PropTypes.string,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    label: PropTypes.node,
  }
}
