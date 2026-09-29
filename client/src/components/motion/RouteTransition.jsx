import React, { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../../lib/motion';

/**
 * Fades each page in as the route changes. Entrance only: the outgoing page is
 * gone the moment React Router swaps it, which keeps navigation instant and
 * avoids holding two pages (and their sockets) mounted at once.
 */
export default function RouteTransition({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, clearProps: CLEAR }
      );
    },
    { dependencies: [pathname], scope: ref }
  );

  return <div ref={ref}>{children}</div>;
}
