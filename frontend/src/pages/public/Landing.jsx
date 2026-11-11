import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useBrowserLayoutEffect from '../../hooks/useBrowserLayoutEffect.js'
import usePageTitle from '../../hooks/usePageTitle.js'
import useReveal from '../../hooks/useReveal.js'
import LandingDecoration from '../../components/landing/LandingDecoration.jsx'
import Header from '../../components/landing/Header.jsx'
import Hero from '../../components/landing/Hero.jsx'
import BenefitsChecklist from '../../components/landing/BenefitsChecklist.jsx'
import FeatureCards from '../../components/landing/FeatureCards.jsx'
import AboutSection from '../../components/landing/AboutSection.jsx'
import CtaBand from '../../components/landing/CtaBand.jsx'
import Footer from '../../components/landing/Footer.jsx'
import '../../components/landing/landing.css'

export default function Landing() {
  const scope = useRef(null)
  const { hash } = useLocation()
  usePageTitle('')
  useReveal(scope)
  useBrowserLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])
  useBrowserLayoutEffect(() => {
    // Router links retain hash history; direct URLs arrive before targets mount.
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  return <div ref={scope} className="landing-content">
    <LandingDecoration />
    <Header />
    <Hero />
    <BenefitsChecklist />
    <FeatureCards />
    <AboutSection />
    <CtaBand />
    <Footer />
  </div>
}
