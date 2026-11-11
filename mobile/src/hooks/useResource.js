import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
export default function useResource(service, argument) {
  const [state, setState] = useState({ data: null, loading: true, refreshing: false, error: '' })
  const version = useRef(0), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; version.current++ } }, [])
  const refresh = useCallback(async () => {
    const current = ++version.current
    setState(s => ({ ...s, refreshing: Boolean(s.data), loading: !s.data, error: '' }))
    try { const result = await service(argument); if (mounted.current && current === version.current) setState({ data: result.data, redirect: result.redirect, loading: false, refreshing: false, error: '' }) }
    catch (error) { if (mounted.current && current === version.current) setState(s => ({ ...s, error: error.message, loading: false, refreshing: false })) }
  }, [service, argument])
  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))
  return { ...state, refresh, setData: data => setState(s => ({ ...s, data })) }
}
