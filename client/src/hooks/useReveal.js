import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../lib/motion';

/**
 * Staggered entrance for the items of a list or grid.
 *
 * Items animate the first time they appear: all of them on first render, and
 * afterwards only the ones that are new (a new card, the next AI answer). Each
 * item is marked once shown, so refetches and re-renders never replay the
 * animation on content the user is already looking at.
 *
 * @param {React.RefObject<HTMLElement>} scopeRef - the list container
 * @param {object}  [options]
 * @param {string}  [options.selector] - which descendants are items (default: direct children)
 * @param {Array}   [options.deps]     - re-check for new items when these change
 * @param {number}  [options.y]        - distance items rise from, in px
 * @param {number}  [options.stagger]  - seconds between items
 */
export function useReveal(scopeRef, { selector = ':scope > *', deps = [], y = 14, stagger = 0.05 } = {}) {
  useGSAP(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      const items = [...root.querySelectorAll(selector)].filter((el) => !el.dataset.revealed);
      if (items.length === 0) return;
      items.forEach((el) => {
        el.dataset.revealed = 'true';
      });

      if (prefersReducedMotion()) return;
      gsap.from(items, { autoAlpha: 0, y, stagger, clearProps: CLEAR });
    },
    { scope: scopeRef, dependencies: deps }
  );
}
