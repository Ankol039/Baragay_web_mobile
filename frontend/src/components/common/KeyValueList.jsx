import { pairs, record } from '../../propTypes.js'
export default function KeyValueList({ rows, style }) {
  return <ul className="db-kv" style={style}>{rows.map(([label, value]) => <li key={label}>
    <span className="db-kv-key">{label}</span><span className="db-kv-val">{value}</span>
  </li>)}</ul>
}

if (import.meta.env.DEV) {
  KeyValueList.propTypes = {
    rows: pairs.isRequired,
    style: record,
  }
}
