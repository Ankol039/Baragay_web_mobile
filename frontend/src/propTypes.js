import PropTypes from 'prop-types'

// Shared UI contracts. API records are validated at their PHP serialization boundary;
// these validators document the values consumed by reusable React components.
export const identifier = PropTypes.oneOfType([PropTypes.number, PropTypes.string])
export const record = PropTypes.object
export const records = PropTypes.arrayOf(record)
export const pairs = PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.node))
export const series = PropTypes.arrayOf(PropTypes.shape({
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
}))
export const filters = PropTypes.arrayOf(PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
}))
export const columns = PropTypes.arrayOf(PropTypes.shape({
  key: PropTypes.string.isRequired,
  label: PropTypes.node,
  render: PropTypes.func,
  headerProps: record,
  cellProps: record,
}))
export const fieldSpec = PropTypes.objectOf(PropTypes.shape({
  label: PropTypes.string.isRequired,
  type: PropTypes.string,
  required: PropTypes.bool,
  maxlength: PropTypes.number,
  placeholder: PropTypes.string,
  options: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), record]),
}))
export const user = PropTypes.shape({
  account_type: PropTypes.oneOf(['resident', 'staff']).isRequired,
  role: PropTypes.oneOf(['resident', 'staff', 'admin']).isRequired,
  display_name: PropTypes.string,
  initial: PropTypes.string,
  photo: PropTypes.string,
  is_first_login: PropTypes.bool,
  profile_completed: PropTypes.bool,
  show_sidebar: PropTypes.bool,
})
export const queue = PropTypes.shape({
  busy: PropTypes.bool.isRequired,
  open: PropTypes.func.isRequired,
  run: PropTypes.func.isRequired,
  review: PropTypes.func.isRequired,
})
