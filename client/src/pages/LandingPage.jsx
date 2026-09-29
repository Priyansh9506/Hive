import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../lib/motion';

export default function LandingPage() {
  const rootRef = useRef(null);

  // Header settles in, then the headline rises line by line, followed by the
  // pitch and the calls to action. Everything is on screen within ~1s.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ defaults: { clearProps: CLEAR } })
        .from('[data-anim="header"]', { autoAlpha: 0, y: -12, duration: 0.5 })
        .from('[data-anim="line"]', { autoAlpha: 0, y: 28, duration: 0.7, stagger: 0.12 }, 0.1)
        .from('[data-anim="copy"]', { autoAlpha: 0, y: 16, duration: 0.6 }, '-=0.4')
        .from('[data-anim="cta"] > *', { autoAlpha: 0, y: 12, scale: 0.96, duration: 0.5, stagger: 0.08 }, '-=0.35')
        .from('[data-anim="footer"]', { autoAlpha: 0, duration: 0.6 }, '-=0.3');
    },
    { scope: rootRef }
  );

  return (
    <div ref={rootRef} className="flex flex-col min-h-screen bg-background">
      <header data-anim="header" className="px-6 py-4 flex justify-between items-center border-b border-border">
        <h1 className="text-xl font-bold text-primary">StudySync</h1>
        <nav className="space-x-4">
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/signup">
            <Button>Sign Up</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-primary mb-4">
          <span data-anim="line" className="inline-block">Your Real-Time</span> <br />
          <span data-anim="line" className="inline-block">Collaborative Study Workspace</span>
        </h2>
        <p data-anim="copy" className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
          Create a study space, invite classmates, collaborate on notes and discussions, share resources, and work together in real time.
        </p>
        <div data-anim="cta" className="space-x-4">
          <Link to="/signup" className="inline-block">
            <Button size="lg" className="h-12 px-8 text-lg">Get Started</Button>
          </Link>
          <Button variant="outline" size="lg" className="h-12 px-8 text-lg">Learn More</Button>
        </div>
      </main>

      <footer data-anim="footer" className="py-6 border-t border-border text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} StudySync. All rights reserved.
      </footer>
    </div>
  );
}
