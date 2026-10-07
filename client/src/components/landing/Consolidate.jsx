import React, { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from './gsap';
import { LogoMark } from './primitives';

// The tools a study group juggles today (from the Kolo problem statement).
// Brand marks come from Simple Icons; `x`/`y` place each tile around the centre.
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
 * scattered tool logos into the Kolo mark. The motion is the argument.
 * Below md the section is a static grid with no pinning.
 */
export default function Consolidate() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();

      mm.add(`(min-width: 768px) and ${MOTION_OK}`, () => {
        const hub = q('[data-hub]')[0];

        // Distance from each tile's centre to the hub's centre, measured on
        // every refresh so resizing keeps the tiles converging on target
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
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="relative flex flex-col justify-center py-20 md:min-h-[100dvh] md:py-24">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">
        <div className="relative mx-auto grid max-w-3xl text-center">
          <h2
            data-before
            className="col-start-1 row-start-1 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl"
          >
            Six apps for one study session.
          </h2>
          {/* Only ever shown by the scroll animation */}
          <h2
            data-after
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl"
          >
            Now it&apos;s <span className="italic text-flame">one link.</span>
          </h2>
        </div>

        {/* Desktop stage: tiles scattered around the hub */}
        <div data-stage className="relative mx-auto mt-12 hidden h-[400px] max-w-4xl md:block">
          {TOOLS.map((tool) => (
            <div
              key={tool.slug}
              data-tool
              style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
              className="ls-lift absolute grid size-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-line bg-surface"
            >
              <img src={iconUrl(tool.slug)} alt={tool.name} width="34" height="34" loading="lazy" className="size-[34px]" />
            </div>
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              data-hub-glow
              aria-hidden="true"
              className="absolute -inset-16 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ls-flame)_22%,transparent),transparent_65%)]"
            />
            <div
              data-hub
              className="ls-lift relative grid size-28 place-items-center rounded-[28px] border border-line bg-surface"
            >
              <LogoMark className="size-14" />
            </div>
          </div>
        </div>

        {/* Mobile: the same story, told statically */}
        <div className="mt-10 md:hidden">
          <div className="grid grid-cols-3 gap-3">
            {TOOLS.map((tool) => (
              <div
                key={tool.slug}
                className="grid aspect-square place-items-center rounded-2xl border border-line bg-surface"
              >
                <img src={iconUrl(tool.slug)} alt={tool.name} width="30" height="30" loading="lazy" className="size-[30px]" />
              </div>
            ))}
          </div>
          <p className="mt-8 text-center font-display text-4xl leading-tight">
            Now it&apos;s <span className="italic text-flame">one link.</span>
          </p>
        </div>

        <p className="mx-auto mt-10 max-w-[52ch] text-center text-[17px] leading-relaxed text-ink-soft">
          Chat, notes, files and an AI helper used to live in separate tabs. In Kolo they share one space, so
          nothing gets lost between them.
        </p>
      </div>
    </section>
  );
}
