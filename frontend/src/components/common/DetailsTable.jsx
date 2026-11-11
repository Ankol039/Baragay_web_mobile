import { pairs } from '../../propTypes.js'
export default function DetailsTable({ rows }) {
  return <table className="table-spaced"><tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table>
}

if (import.meta.env.DEV) {
  DetailsTable.propTypes = {
    rows: pairs.isRequired,
  }
}
