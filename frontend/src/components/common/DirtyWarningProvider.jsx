import PropTypes from 'prop-types'
import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { DirtyWarningContext, discardMessage } from '../../context/dirtyWarningContext.js'

// React Router supports one blocker. Aggregate all forms, including multiple
// closed/open modals, behind that single blocker.
export default function DirtyWarningProvider({ children }) {
  const forms = useRef(new Map())
  const register = useCallback((key, guard) => {
    forms.current.set(key, guard)
    return () => forms.current.delete(key)
  }, [])
  const hasChanges = useCallback(() => [...forms.current.values()].some((guard) => guard.isDirty()), [])
  const clearAll = useCallback(() => forms.current.forEach((guard) => guard.clear()), [])
  const blocker = useBlocker(hasChanges)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(discardMessage)) { queueMicrotask(clearAll); blocker.proceed() }
    else blocker.reset()
  }, [blocker, clearAll])
  useEffect(() => {
    const unload = (event) => {
      if (!hasChanges()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const leave = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!hasChanges() || !link || event.defaultPrevented || link.target === '_blank' || link.hasAttribute('download')) return
      const target = new URL(link.href, window.location.href)
      if (target.origin === location.origin && target.pathname.startsWith(import.meta.env.BASE_URL)) return
      if (!window.confirm(discardMessage)) { event.preventDefault(); event.stopPropagation() }
      else clearAll()
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', leave)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave) }
  }, [hasChanges, clearAll])
  return <DirtyWarningContext.Provider value={register}>{children}</DirtyWarningContext.Provider>
}

if (import.meta.env.DEV) {
  DirtyWarningProvider.propTypes = {
    children: PropTypes.node,
  }
}
