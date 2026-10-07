import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { gsap, useGSAP, SplitText, MOTION_OK, EASE_OUT } from '../landing/gsap';
import { Wordmark } from '../landing/primitives';
import LivePreview from '../landing/LivePreview';

/**
 * Shared frame for login and signup, in the landing page's visual language:
 * the form on the left, and on large screens the same live study-space preview
 * as the landing hero on the right, so signing in feels like one continuous
 * product rather than a separate screen.
 */
export default function AuthLayout({ title, subtitle, aside, footer, children }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        SplitText.create(q('[data-auth="title"]'), {
          type: 'lines,words',
          mask: 'lines',
          linesClass: 'ls-line-mask',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, { yPercent: 110, duration: 1.1, ease: EASE_OUT, stagger: 0.05, delay: 0.1 }),
        });
        gsap.from(q('[data-auth="subtitle"], [data-auth-item], [data-auth="footer"]'), {
          autoAlpha: 0,
          y: 14,
          duration: 0.8,
          ease: EASE_OUT,
          stagger: 0.06,
          delay: 0.35,
          clearProps: 'transform,opacity,visibility',
        });
        gsap.from(q('[data-auth="aside-title"]'), { autoAlpha: 0, y: 20, duration: 1, ease: EASE_OUT, delay: 0.3 });
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className="landing grid min-h-[100dvh] grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col px-4 py-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Hive home">
            <Wordmark />
          </Link>
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft
              size={15}
              strokeWidth={1.75}
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            Home
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px]">
            <h1
              data-auth="title"
              className="font-display text-[2.75rem] leading-[1.05] tracking-[-0.02em] sm:text-5xl"
            >
              {title}
            </h1>
            <p data-auth="subtitle" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {subtitle}
            </p>
            <div className="mt-9">{children}</div>
            <p data-auth="footer" className="mt-8 text-center text-sm text-ink-soft">
              {footer}
            </p>
          </div>
        </main>
      </div>

      {/* Product preview, large screens only */}
      <aside className="relative hidden overflow-hidden p-3 lg:block">
        <div className="ls-dots relative flex h-full flex-col justify-center overflow-hidden rounded-2xl border border-line bg-sunk/70 px-10 py-12 xl:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ls-flame)_16%,transparent),transparent_65%)]"
          />
          <p
            data-auth="aside-title"
            className="relative max-w-[18ch] font-display text-4xl leading-[1.08] tracking-[-0.02em] xl:text-5xl"
          >
            {aside}
          </p>
          <div className="relative mt-10">
            <LivePreview />
          </div>
        </div>
      </aside>
    </div>
  );
}
