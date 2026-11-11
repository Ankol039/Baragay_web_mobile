import { useEffect } from 'react'

// Match landing.php's one-time reveal and timing. Each mount owns its observer.
export default function useReveal(scope) {
  useEffect(() => {
    const reveals = Array.from(scope.current?.querySelectorAll('.reveal') || [])
    if (!reveals.length) return
    if (typeof IntersectionObserver === 'undefined') {
      reveals.forEach((element) => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return
        const delay = parseInt(target.dataset.delay || '0', 10)
        target.style.transitionDelay = delay ? `${delay}ms` : '0ms'
        target.classList.add('is-visible')
        observer.unobserve(target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    reveals.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [scope])
}
