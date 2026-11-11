import { useCallback, useContext, useId, useRef, useState } from 'react'
import useBrowserLayoutEffect from './useBrowserLayoutEffect.js'
import { DirtyWarningContext, discardMessage } from '../context/dirtyWarningContext.js'

export default function useDirtyWarning({ enabled = true } = {}) {
  const [dirty, setDirty] = useState(false)
  const register = useContext(DirtyWarningContext)
  const key = useId()
  const dirtyNow = useRef(false)
  useBrowserLayoutEffect(() => { dirtyNow.current = enabled && dirty }, [enabled, dirty])
  const clear = useCallback(() => { dirtyNow.current = false; setDirty(false) }, [])
  const markDirty = useCallback(() => { dirtyNow.current = enabled; setDirty(true) }, [enabled])
  useBrowserLayoutEffect(() => {
    if (!register) throw new Error('useDirtyWarning requires DirtyWarningProvider.')
    return register(key, { isDirty: () => dirtyNow.current, clear })
  }, [register, key, clear])
  const confirmDiscard = useCallback(() => {
    if (enabled && dirty && !window.confirm(discardMessage)) return false
    clear()
    return true
  }, [dirty, enabled, clear])
  return { dirty, markDirty, clear, confirmDiscard,
    formProps: { 'data-dirty-warn': '', onInput: markDirty, onChange: markDirty, onSubmit: clear } }
}
