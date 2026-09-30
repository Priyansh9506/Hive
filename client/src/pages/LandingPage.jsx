import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ScrollTrigger } from '../components/landing/gsap';
import Nav from '../components/landing/Nav';
import Hero from '../components/landing/Hero';
import Consolidate from '../components/landing/Consolidate';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import Manifesto from '../components/landing/Manifesto';
import Faq from '../components/landing/Faq';
import FinalCta from '../components/landing/FinalCta';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  // One label per intent across the page: new visitors start a space,
  // signed-in visitors go back to their dashboard
  const cta = isAuthenticated
    ? { to: '/dashboard', label: 'Open dashboard', authed: true }
    : { to: '/signup', label: 'Start a space', authed: false };

  // Pin and trigger positions depend on final text layout: re-measure once
  // the web fonts arrive and after the route fade-in has settled
  useEffect(() => {
    let cancelled = false;
    const refresh = () => !cancelled && ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    const t = setTimeout(refresh, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="landing min-h-[100dvh] overflow-x-clip">
      <Nav cta={cta} />
      <main>
        <Hero cta={cta} />
        <Consolidate />
        <Features />
        <HowItWorks />
        <Manifesto />
        <Faq />
        <FinalCta cta={cta} />
      </main>
      <Footer cta={cta} />
    </div>
  );
}
