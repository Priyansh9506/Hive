import React, { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from './gsap';
import { LogoMark } from './primitives';

// The tools a study group juggles today (from the Hive problem statement).
// Brand marks come from Simple Icons; `x`/`y` place each tile around the centre
// as a share of the stage, so the layout scales from phones to desktops.
const TOOLS = [
  { name: 'WhatsApp', slug: 'whatsapp', x: 10, y: 22 },
  { name: 'Google Docs', slug: 'googledocs', x: 30, y: 78 },
  { name: 'Google Drive', slug: 'googledrive', x: 24, y: 8 },
  { name: 'Discord', slug: 'discord', x: 76, y: 10 },
  { name: 'Notion', slug: 'notion/_/white', x: 90, y: 58 },
  { name: 'Gemini', slug: 'googlegemini', x: 68, y: 84 },
];

const iconUrl = (slug) => `https://cdn.simpleicons.org/${slug}`;

/**
 * "Six apps become one link": while the section is pinned, scrolling pulls the
 * scattered tool logos into the Hive mark. The motion is the argument, so it
 * runs at every screen size; the stage, tiles and hub just scale down on
 * tablets and phones. With reduced motion the finished state is shown.
 */
export default function Consolidate() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const hub = q('[data-hub]')[0];

        // Distance from each tile's centre to the hub's centre, measured on
        // every refresh so resizing or rotating keeps the tiles on target
        const toHub = (axis) => (i, tile) => {
          const t = tile.getBoundingClientRect();
          const h = hub.getBoundingClientRect();
          return axis === 'x'
            ? h.left + h.width / 2 - (t.left + t.width / 2)
            : h.top + h.height / 2 - (t.top + t.height / 2);
        };

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          scrollTrigger: {
            trigger: ref.current,
            start: 'top top',
            end: '+=110%',
            pin: true,
            anticipatePin: 1,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });

        // The scattered tiles are already in place when the section pins, so
        // the reader sees the mess before it gets tidied up
        tl.to({}, { duration: 0.2 })
          .to(
            q('[data-tool]'),
            { x: toHub('x'), y: toHub('y'), scale: 0.35, rotate: 'random(-25, 25)', duration: 1, stagger: 0.05 },
            0.2
          )
          .to(q('[data-tool]'), { autoAlpha: 0, duration: 0.2, stagger: 0.05 }, 0.95)
          .to(q('[data-before]'), { autoAlpha: 0, yPercent: -40, duration: 0.35 }, 0.65)
          .from(q('[data-after]'), { autoAlpha: 0, yPercent: 40, duration: 0.35 }, 0.9)
          .to(hub, { scale: 1.35, duration: 0.5, ease: 'back.out(2.5)' }, 1.0)
          .from(q('[data-hub-glow]'), { autoAlpha: 0, scale: 0.4, duration: 0.5 }, 1.0)
          .to({}, { duration: 0.3 }); // short hold on the finished state

        // Tiles drop in as the section approaches (not scrubbed)
        gsap.from(q('[data-tool] > img'), {
          autoAlpha: 0,
          scale: 0.4,
          duration: 0.7,
          ease: 'back.out(2.5)',
          stagger: 0.06,
          scrollTrigger: { trigger: ref.current, start: 'top 65%', once: true },
        });
      });

      // Reduced motion: no pinning or movement, but still land on the point
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(q('[data-before]'), { autoAlpha: 0 });
        gsap.set(q('[data-after]'), { autoAlpha: 1 });
      });
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col justify-center py-16 md:py-24 [@media(max-height:520px)]:py-6">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <div className="relative mx-auto grid max-w-3xl text-center">
          <h2
            data-before
            className="col-start-1 row-start-1 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl"
          >
            Six apps for one study session.
          </h2>
          {/* Only ever shown by the scroll animation (or with reduced motion) */}
          <h2
            data-after
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl"
          >
            Now it&apos;s <span className="italic text-flame">one link.</span>
          </h2>
        </div>

        {/* Stage: tiles scattered around the hub, sized for the screen */}
        <div data-stage className="relative mx-auto mt-10 h-[300px] max-w-4xl sm:mt-12 sm:h-[360px] md:h-[400px] [@media(max-height:520px)]:mt-6 [@media(max-height:520px)]:h-[200px]">
          {TOOLS.map((tool) => (
            <div
              key={tool.slug}
              data-tool
              style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
              className="ls-lift absolute grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-line bg-surface sm:size-16 sm:rounded-2xl md:size-[76px]"
            >
              <img
                src={iconUrl(tool.slug)}
                alt={tool.name}
                width="34"
                height="34"
                loading="lazy"
                className="size-[26px] sm:size-[30px] md:size-[34px]"
              />
            </div>
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              data-hub-glow
              aria-hidden="true"
              className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ls-flame)_22%,transparent),transparent_65%)] md:-inset-16"
            />
            <div
              data-hub
              className="ls-lift relative grid size-20 place-items-center rounded-[22px] border border-line bg-surface sm:size-24 sm:rounded-[26px] md:size-28 md:rounded-[28px]"
            >
              <LogoMark className="size-10 sm:size-12 md:size-14" />
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-[52ch] text-center text-[17px] leading-relaxed text-ink-soft">
          Chat, notes, files and an AI helper used to live in separate tabs. In Hive they share one space, so
          nothing gets lost between them.
        </p>
      </div>
    </section>
  );
}
