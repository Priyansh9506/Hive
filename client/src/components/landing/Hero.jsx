import React, { useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { gsap, useGSAP, SplitText, MOTION_OK, EASE_OUT, scrollToSection } from './gsap';
import { MagneticButton } from './primitives';
import LivePreview from './LivePreview';

export default function Hero({ cta }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const intro = gsap.timeline({ defaults: { ease: EASE_OUT } });

        intro.from(q('[data-hero="pill"]'), { autoAlpha: 0, y: 14, duration: 0.8 }, 0.15);

        // Headline rises word by word from behind a mask on each line. Only
        // once the last word has settled does the underline under "one room"
        // draw in, like a pen stroke added after the sentence is written.
        SplitText.create(q('[data-hero="title"]'), {
          type: 'lines,words',
          mask: 'lines',
          linesClass: 'ls-line-mask',
          autoSplit: true,
          // Returned (not nested in `intro`) so a re-split on resize or font
          // load can rebuild it at the same progress
          onSplit: (self) =>
            gsap
              .timeline({ delay: 0.25 })
              .from(self.words, { yPercent: 110, duration: 1.2, ease: EASE_OUT, stagger: 0.055 })
              // expo.out has the last word visually at rest ~0.5s into its
              // tween, so the stroke starts there rather than at the tail
              .from(q('[data-hero="underline"]'), { scaleX: 0, duration: 0.75, ease: 'power2.inOut' }, '-=0.65'),
        });

        intro
          .from(q('[data-hero="copy"]'), { autoAlpha: 0, y: 18, duration: 1 }, 0.7)
          .from(q('[data-hero="cta"] > *'), { autoAlpha: 0, y: 16, duration: 0.9, stagger: 0.08 }, 0.85);
      });
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative overflow-hidden pb-12 pt-28 md:pb-16 lg:pt-36">
      {/* Faint grid that fades out toward the edges; sits behind everything */}
      <div
        aria-hidden="true"
        className="ls-dots pointer-events-none absolute inset-x-0 top-0 -z-0 h-[720px] [mask-image:radial-gradient(ellipse_70%_60%_at_70%_30%,black,transparent)]"
      />

      <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <a
            data-hero="pill"
            href="#ai"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('ai');
            }}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[13px] text-ink-soft transition-colors hover:border-flame/40 hover:text-ink"
          >
            <span className="rounded-full bg-flame-wash px-2 py-0.5 text-xs font-medium text-flame">New</span>
            Gemini study assistant
            <ArrowUpRight
              size={14}
              strokeWidth={1.75}
              className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>

          <h1
            data-hero="title"
            className="mt-6 font-display text-[3.25rem] leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-[4rem] xl:text-[4.75rem]"
          >
            Your study group, in{' '}
            <span className="relative inline-block whitespace-nowrap italic">
              one room.
              <span
                data-hero="underline"
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[0.06em] h-[0.07em] origin-left rounded-full bg-flame"
              />
            </span>
          </h1>

          <p data-hero="copy" className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-ink-soft">
            Notes that sync as you type, a chat that keeps the answers, and every shared file, in one link.
          </p>

          <div data-hero="cta" className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <MagneticButton to={cta.to}>{cta.label}</MagneticButton>
            <MagneticButton
              variant="ghost"
              arrow={false}
              strength={0.18}
              onClick={() => scrollToSection('how')}
            >
              See how it works
            </MagneticButton>
          </div>
        </div>

        <div className="lg:col-span-7">
          <LivePreview />
        </div>
      </div>
    </section>
  );
}
