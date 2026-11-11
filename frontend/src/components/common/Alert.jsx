import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import useBrowserLayoutEffect from '../../hooks/useBrowserLayoutEffect.js'
import Toast from './Toast.jsx'

export default function Alert({ type = 'info', children, inline = false, className = '', ...props }) {
  const element = useRef(null)
  const [toast, setToast] = useState(false)
  useBrowserLayoutEffect(() => {
    const node = element.current
    if (inline || !['success', 'error'].includes(type) || !node || node.closest('.modal-overlay')) return
    const parent = node.parentElement
    setToast(parent.classList.contains('container') ||
      (node === parent.firstElementChild && (parent.classList.contains('card') || parent.classList.contains('grid-2'))))
  }, [type, inline])
  if (toast && !inline && ['success', 'error'].includes(type)) return <Toast type={type}>{children}</Toast>
  return <div {...props} ref={element} className={`alert alert-${type}${className ? ` ${className}` : ''}`}
    role={type === 'error' ? 'alert' : 'status'}>{children}</div>
}

if (import.meta.env.DEV) {
  Alert.propTypes = {
    type: PropTypes.string,
    children: PropTypes.node,
    inline: PropTypes.bool,
    className: PropTypes.string,
  }
}
