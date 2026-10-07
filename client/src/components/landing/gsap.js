import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { TextPlugin } from 'gsap/TextPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { gsap, useGSAP } from '../../lib/motion';

// Scroll and text plugins are only needed by the landing page, so they are
// registered here rather than in lib/motion (which every app screen imports).
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText, TextPlugin, ScrambleTextPlugin);

// Phones resize the viewport whenever the address bar slides in or out while
// scrolling; re-measuring then would make pinned sections jump
ScrollTrigger.config({ ignoreMobileResize: true });

// Every landing animation is written inside this media query, so visitors who
// ask for reduced motion get the finished layout with nothing moving.
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

// Expo-like deceleration used for every text reveal on the page
export const EASE_OUT = 'expo.out';

/** Smooth-scrolls to a section, leaving room for the fixed nav. */
export function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.to(window, {
    scrollTo: { y: target, offsetY: 72 },
    duration: reduce ? 0 : 1.1,
    ease: 'power3.inOut',
  });
}

/** Tracks the pointer inside `.ls-spot` tiles for the soft highlight. */
export function trackSpot(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/** A short sideways shake: "that didn't work", for a rejected form. */
export function shake(el) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(
    el,
    { x: 0 },
    { keyframes: { x: [0, -9, 8, -6, 4, -2, 0] }, duration: 0.5, ease: 'power1.out', clearProps: 'transform' }
  );
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
