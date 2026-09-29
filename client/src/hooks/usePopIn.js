import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../lib/motion';

/**
 * Menus and popovers grow out of the control that opened them. Entrance only:
 * a menu should get out of the way the instant it is dismissed.
 *
 * @param {React.RefObject<HTMLElement>} ref - the popover element
 * @param {boolean} open
 * @param {string} [origin] - CSS transform-origin, e.g. the corner nearest the trigger
 */
export function usePopIn(ref, open, origin = 'top right') {
  useGSAP(
    () => {
      if (!open || !ref.current || prefersReducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: -6, scale: 0.96, transformOrigin: origin },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, clearProps: `${CLEAR},transformOrigin` }
      );
    },
    { dependencies: [open] }
  );
}
