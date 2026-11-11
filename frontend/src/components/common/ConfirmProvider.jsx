import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from './ConfirmModal.jsx'

export default function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null)
  const navigate = useNavigate()
  useEffect(() => {
    const capture = (event) => {
      const trigger = event.target.closest?.('[data-confirm]')
      if (!trigger || trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return
      event.preventDefault()
      event.stopPropagation()
      setPending({ trigger, message: trigger.getAttribute('data-confirm') })
    }
    document.addEventListener('click', capture, true)
    return () => document.removeEventListener('click', capture, true)
  }, [])
  function proceed() {
    const { trigger } = pending
    setPending(null)
    const form = trigger.form || trigger.closest('form')
    if (!trigger.hasAttribute('href') && form) {
      form.setAttribute('data-confirmed-submit', '1')
      // Native requestSubmit preserves the submitter name/value and validation.
      const submitter = ['submit', 'image'].includes(trigger.type) ? trigger : undefined
      let carried
      if (!submitter && trigger.name) {
        carried = document.createElement('input')
        carried.type = 'hidden'
        carried.name = trigger.name
        carried.value = trigger.value || ''
        form.appendChild(carried)
      }
      form.requestSubmit(submitter)
      carried?.remove()
      form.removeAttribute('data-confirmed-submit')
      return
    }
    const destination = new URL(trigger.getAttribute('href') || '#', window.location.href)
    const base = import.meta.env.BASE_URL
    if (destination.origin === window.location.origin && destination.pathname.startsWith(base)) {
      navigate(`/${destination.pathname.slice(base.length)}${destination.search}${destination.hash}`)
    } else window.location.assign(destination.href)
  }
  return <>{children}<ConfirmModal open={!!pending} message={pending?.message} onClose={() => setPending(null)} onConfirm={proceed} /></>
}

if (import.meta.env.DEV) {
  ConfirmProvider.propTypes = {
    children: PropTypes.node,
  }
}
