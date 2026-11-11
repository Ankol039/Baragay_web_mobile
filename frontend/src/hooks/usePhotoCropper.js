import { useEffect, useRef, useState } from 'react'

// Port of script.js: cover scaling, center-preserving zoom, clamped dragging,
// dark canvas fill, high quality smoothing and a square 320px JPEG at 0.9.
export default function usePhotoCropper(file, initialZoom = 1) {
  const canvas = useRef(null)
  const image = useRef(null)
  const crop = useRef({})
  const [zoom, setZoomValue] = useState(initialZoom)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  function render() {
    if (!canvas.current || !image.current?.naturalWidth) return
    const state = crop.current, size = canvas.current.width
    state.x = Math.min(0, Math.max(Math.min(0, size - state.width), state.x))
    state.y = Math.min(0, Math.max(Math.min(0, size - state.height), state.y))
    const ctx = canvas.current.getContext('2d', { alpha: false })
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#102d35'; ctx.fillRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.current, state.x, state.y, state.width, state.height)
    setPreview(canvas.current.toDataURL('image/jpeg', 0.9))
  }
  useEffect(() => {
    if (!file) return
    const img = new Image()
    const load = new AbortController()
    let url
    image.current = img
    img.onload = () => {
      const size = canvas.current.width
      const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight)
      const width = img.naturalWidth * baseScale * initialZoom, height = img.naturalHeight * baseScale * initialZoom
      crop.current = { baseScale, width, height, x: (size - width) / 2, y: (size - height) / 2, dragging: false }
      setZoomValue(initialZoom); setReady(true); render()
    }
    img.onerror = () => setError('Unable to read that image. Please choose another photo.')
    // StrictMode discards the first setup before its image request can start.
    // Starting that request immediately and revoking it in cleanup logs a blob 404.
    queueMicrotask(() => {
      if (load.signal.aborted) return
      url = URL.createObjectURL(file)
      img.src = url
    })
    return () => {
      load.abort(); img.onload = null; img.onerror = null
      img.removeAttribute?.('src')
      if (image.current === img) image.current = null
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, initialZoom])
  function setZoom(value) {
    if (!image.current?.naturalWidth) return
    const state = crop.current, size = canvas.current.width
    const centerX = (size / 2 - state.x) / state.width, centerY = (size / 2 - state.y) / state.height
    const next = Math.min(3, Math.max(1, Number(value)))
    state.width = image.current.naturalWidth * state.baseScale * next
    state.height = image.current.naturalHeight * state.baseScale * next
    state.x = size / 2 - state.width * centerX; state.y = size / 2 - state.height * centerY
    setZoomValue(next); render()
  }
  function position(event) {
    const rect = canvas.current.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * canvas.current.width / rect.width,
      y: (event.clientY - rect.top) * canvas.current.height / rect.height }
  }
  function start(event) {
    if (!ready) return
    const point = position(event), state = crop.current
    Object.assign(state, { dragging: true, startX: point.x, startY: point.y, originX: state.x, originY: state.y })
    setDragging(true); canvas.current.setPointerCapture(event.pointerId)
  }
  function move(event) {
    if (!crop.current.dragging) return
    const point = position(event), state = crop.current
    state.x = state.originX + point.x - state.startX; state.y = state.originY + point.y - state.startY
    render()
  }
  function end(event) {
    crop.current.dragging = false; setDragging(false)
    try { canvas.current.releasePointerCapture(event.pointerId) } catch { /* Already released. */ }
  }
  async function jpeg() {
    if (!ready) throw new Error('Unable to prepare the resized photo. Please try again.')
    const blob = await new Promise(resolve => canvas.current.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('Unable to prepare the resized photo. Please try again.')
    return new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' })
  }
  return { canvas, zoom, setZoom, preview, error, ready, dragging, jpeg,
    pointerProps: { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end } }
}
