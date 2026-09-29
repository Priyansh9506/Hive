import React, { useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../../lib/motion';

/**
 * A block that eases in when it first appears: a result card, an error, a
 * newly revealed explanation. For lists of items, use `useReveal` instead.
 */
export default function Reveal({ children, className = '', y = 10, delay = 0, ...rest }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(ref.current, { autoAlpha: 0, y, delay, duration: 0.4, clearProps: CLEAR });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
