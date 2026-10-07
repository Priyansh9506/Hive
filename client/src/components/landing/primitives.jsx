import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { gsap, useGSAP, SplitText, MOTION_OK, EASE_OUT } from './gsap';

// Hive mark: one honeycomb cell, partly filled. Traced from the logo artwork
// (98.7% pixel overlap): a rounded hexagon with smooth (squircle-style)
// corners, minus a cut-out taken from the inner hexagon without its lower-left
// third. The solid part is what the group already knows, the open part what
// it is working on. One even-odd path in a 64x64 box; public/favicon.svg and
// the PWA icons are rendered from the same curves.
const HIVE_MARK =
  'M15.07 56.06L2.7 34.63C1.77 33.02 1.77 30.98 2.7 29.37L15.07 7.94C16 6.33 17.76 5.31 19.63 5.31L44.37 5.31C46.24 5.31 48 6.33 48.93 7.94L61.3 29.37C62.23 30.98 62.23 33.02 61.3 34.63L48.93 56.06C48 57.67 46.24 58.69 44.37 58.69L19.63 58.69C17.76 58.69 16 57.67 15.07 56.06Z' +
  'M28.83 32L14.41 32C12.1 32 10.69 29.55 11.85 27.56L19.89 13.62C20.35 12.82 21.21 12.32 22.14 12.32L41.86 12.32C42.79 12.32 43.65 12.82 44.11 13.62L53.97 30.7C54.43 31.5 54.43 32.5 53.97 33.3L45.57 47.85C44.56 49.59 42.16 49.59 41.15 47.85L33.59 34.75C32.48 32.84 31.03 32 28.83 32Z';

/** The Hive mark. Takes the theme's ink colour unless `color` says otherwise. */
export function LogoMark({ className = 'size-7', color = 'var(--ls-ink)' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path fillRule="evenodd" d={HIVE_MARK} fill={color} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[18px] font-semibold tracking-tight">StudySync</span>
    </span>
  );
}

const VARIANTS = {
  flame: 'bg-flame text-flame-ink',
  ink: 'bg-ink text-paper',
  ghost: 'border border-line bg-surface text-ink hover:bg-sunk',
};

const SIZES = {
  sm: 'h-9 pl-4 pr-3.5 text-sm gap-1.5',
  lg: 'h-12 pl-6 pr-5 text-[15px] gap-2',
};

/**
 * Pill CTA that leans toward the pointer (a small "this is clickable" cue) and
 * springs back on leave. Position is driven by gsap.quickTo on the element, so
 * pointer movement never re-renders React.
 */
export function MagneticButton({
  to,
  onClick,
  children,
  variant = 'flame',
  size = 'lg',
  arrow = true,
  className = '',
  strength = 0.28,
}) {
  const wrapRef = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`(hover: hover) and ${MOTION_OK}`, () => {
        const wrap = wrapRef.current;
        const btn = wrap.firstElementChild;
        const label = btn.querySelector('[data-label]');
        const moveX = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
        const moveY = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
        const labelX = gsap.quickTo(label, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });

        const onMove = (e) => {
          const r = wrap.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          moveX(dx * strength);
          moveY(dy * strength);
          labelX(dx * strength * 0.35);
        };
        const onLeave = () => {
          moveX(0);
          moveY(0);
          labelX(0);
        };

        wrap.addEventListener('pointermove', onMove);
        wrap.addEventListener('pointerleave', onLeave);
        return () => {
          wrap.removeEventListener('pointermove', onMove);
          wrap.removeEventListener('pointerleave', onLeave);
        };
      });
    },
    { scope: wrapRef }
  );

  const classes = `group relative inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-[background-color,box-shadow] duration-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  const inner = (
    <span data-label className="inline-flex items-center gap-[inherit]">
      {children}
      {arrow && (
        <span className="relative inline-flex size-4 overflow-hidden">
          <ArrowRight
            size={16}
            strokeWidth={1.75}
            className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-5"
          />
          <ArrowRight
            size={16}
            strokeWidth={1.75}
            className="absolute inset-0 -translate-x-5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0"
          />
        </span>
      )}
    </span>
  );

  // The padded wrapper widens the magnetic field slightly beyond the pill
  return (
    <span ref={wrapRef} className="-m-3 inline-block p-3">
      {to ? (
        <Link to={to} className={classes}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classes}>
          {inner}
        </button>
      )}
    </span>
  );
}

/**
 * Section headline that rises line by line (masked) the first time it scrolls
 * into view. SplitText re-splits on resize and font load, and the reveal is
 * rebuilt from its current progress so nothing jumps.
 */
export function RevealHeading({ as: Tag = 'h2', className = '', children, start = 'top 85%' }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const el = ref.current;
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'ls-line-mask',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 105,
              duration: 1.1,
              ease: EASE_OUT,
              stagger: 0.09,
              scrollTrigger: { trigger: el, start, once: true },
            }),
        });
      });
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * A collaborator's text cursor with their name tag, as in the real editor.
 * The tag hangs below the caret and ends at it: a caret always sits at the end of its
 * paragraph, so below is the paragraph gap and never covers typed text.
 */
export function Caret({ name, tone, dataKey }) {
  const bar = tone === 'flame' ? 'bg-flame' : 'bg-ink';
  const tag = tone === 'flame' ? 'bg-flame text-flame-ink' : 'bg-ink text-paper';
  return (
    <span data-caret={dataKey} className="relative ml-px inline-block h-[1.15em] w-[2px] translate-y-[0.2em] align-baseline">
      <span className={`ls-caret absolute inset-0 rounded-full ${bar}`} />
      <span className={`absolute right-0 top-full mt-0.5 whitespace-nowrap rounded-full px-1.5 py-px font-geist text-[10px] font-medium leading-4 ${tag}`}>
        {name}
      </span>
    </span>
  );
}
