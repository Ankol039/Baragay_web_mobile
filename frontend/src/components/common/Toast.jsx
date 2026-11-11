import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// One shared live region, even when a page emits several notifications.
let users = 0
function acquireHost() {
  let host = document.getElementById('toast-container')
  if (!host) {
    host = document.createElement('div')
    host.id = 'toast-container'
    host.className = 'toast-container'
    host.setAttribute('aria-live', 'polite')
    host.setAttribute('aria-atomic', 'true')
    document.body.appendChild(host)
  }
  users++
  return host
}

export default function Toast({ type = 'success', children, onDismiss }) {
  const [host, setHost] = useState(null)
  const [phase, setPhase] = useState('visible')
  useEffect(() => {
    const target = acquireHost()
    // The portal target belongs to the document and is acquired after mount.
    queueMicrotask(() => setHost(target))
    const fade = window.setTimeout(() => setPhase('leaving'), 6000)
    const remove = window.setTimeout(() => setPhase('removed'), 6220)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(remove)
      if (--users === 0) target.remove()
    }
  }, [])
  useEffect(() => { if (phase === 'removed') onDismiss?.() }, [phase, onDismiss])
  if (!host || phase === 'removed') return null
  return createPortal(<div className={`toast toast-${type}`} style={phase === 'leaving'
    ? { animation: 'none', opacity: 0, transform: 'translateY(16px)', transition: 'opacity 220ms, transform 220ms' } : undefined}>
    <div className="toast-message">{children}</div>
  </div>, host)
}

if (import.meta.env.DEV) {
  Toast.propTypes = {
    type: PropTypes.string,
    children: PropTypes.node,
    onDismiss: PropTypes.func,
  }
}
