import { useEffect, useState } from 'react'
import { getDashboard, getResults, getStatDetail } from './statsService.js'

// Report-specific cancellation keeps existing loading/redirect behavior without legacy transport.
export default function useStatsData(action, key = '', report = false) {
  const stateKey = `${action}:${key}:${report}`
  const [state, setState] = useState({ key: null, data: null, error: '', redirect: null })
  useEffect(() => {
    if (!action) return
    const controller = new AbortController()
    queueMicrotask(async () => {
      if (controller.signal.aborted) return
      try {
        const options = { signal: controller.signal }
        const result = action === 'dashboard' ? await getDashboard(options) : action === 'detail' ? await getStatDetail(key, options) : await getResults(key, report, options)
        if (!controller.signal.aborted) setState({ key: stateKey, data: result.data, error: '', redirect: result.redirect })
      } catch (error) {
        if (!controller.signal.aborted) setState({ key: stateKey, data: null, error: error.message, redirect: null })
      }
    })
    return () => controller.abort()
  }, [action, key, report, stateKey])
  return state.key === stateKey ? { ...state, loading: false } : { data: null, error: '', loading: true }
}
