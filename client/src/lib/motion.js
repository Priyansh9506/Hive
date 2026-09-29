import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Registered once here; every animated component imports gsap from this file
gsap.registerPlugin(useGSAP);

// One motion language for the whole app: quick, soft deceleration, small
// distances. Only transform and opacity are animated, which stay on the GPU.
//
// `lazy: false` applies an entrance's starting state (e.g. opacity 0) the
// moment the tween is created, inside React's layout effect, instead of on
// GSAP's next tick. Otherwise a busy main thread could paint one frame of the
// element fully visible before it animates in. Lazy rendering only pays off
// with hundreds of simultaneous tweens, which this app never has.
gsap.defaults({ ease: 'power3.out', duration: 0.45, lazy: false });

export const DURATION = { fast: 0.2, base: 0.35, slow: 0.6 };

/**
 * People who ask their OS for reduced motion get the final state immediately.
 * Checked at animation time rather than once, so changing the setting applies
 * without a reload.
 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Inline styles GSAP leaves behind are removed once an entrance finishes. A
// lingering `transform` would make the element the containing block for any
// `position: fixed` descendant (modals, dropdowns) and misplace them.
export const CLEAR = 'transform,opacity,visibility';

export { gsap, useGSAP };
