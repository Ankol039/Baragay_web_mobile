import PropTypes from 'prop-types'
import { useCallback, useEffect, useId, useRef } from 'react'
import useBrowserLayoutEffect from '../../hooks/useBrowserLayoutEffect.js'
import { createPortal } from 'react-dom'
import clearModalFields from '../../utils/clearModalFields.js'

export default function Modal({ id, open, onClose, onReset, beforeClose, keepOnClose = false,
  title, icon, narrow = false, wide = false, className = '', children }) {
  const generated = useId()
  const titleId = `${id || generated}-title`
  const overlay = useRef(null)
  const wasOpen = useRef(open)
  // Callbacks may capture current form state without re-running reset effects.
  const callbacks = useRef({ onClose, onReset, beforeClose })
  useBrowserLayoutEffect(() => { callbacks.current = { onClose, onReset, beforeClose } })
  const close = useCallback(() => {
    if (callbacks.current.beforeClose?.() === false) return
    callbacks.current.onClose?.()
  }, [])
  useBrowserLayoutEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    if (!keepOnClose) {
      if (overlay.current) clearModalFields(overlay.current)
      callbacks.current.onReset?.()
    }
  }, [open, keepOnClose])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const escape = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('keydown', escape)
      if (previous?.isConnected) previous.focus()
    }
  }, [open, close])
  const content = <div id={id} ref={overlay} className={`modal-overlay no-print${open ? ' active' : ''}${className ? ` ${className}` : ''}`}
    data-keep-on-close={keepOnClose ? '' : undefined} aria-hidden={!open}
    onClick={(event) => {
      if (event.target === event.currentTarget || event.target.closest('[data-modal-close]')) close()
    }}>
    <div className={`modal-box${narrow ? ' modal-narrow' : ''}${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <button type="button" className="modal-close" data-modal-close="" aria-label="Close">&times;</button>
      {icon}{title && <h2 id={titleId}>{title}</h2>}
      {(open || keepOnClose) && children}
    </div>
  </div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}

if (import.meta.env.DEV) {
  Modal.propTypes = {
    id: PropTypes.string,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func,
    onReset: PropTypes.func,
    beforeClose: PropTypes.func,
    keepOnClose: PropTypes.bool,
    title: PropTypes.node,
    icon: PropTypes.node,
    narrow: PropTypes.bool,
    wide: PropTypes.bool,
    className: PropTypes.string,
    children: PropTypes.node,
  }
}
