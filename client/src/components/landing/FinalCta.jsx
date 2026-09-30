import React, { useRef } from 'react';
import { gsap, useGSAP, MOTION_OK } from './gsap';
import { MagneticButton, RevealHeading } from './primitives';

// Classmates' cursors drifting over the panel: you won't be studying alone
const CURSORS = [
  { name: 'Meera', className: 'bg-ink text-paper', pos: 'right-[12%] top-[18%]', depth: 26 },
  { name: 'Aarav', className: 'bg-paper text-ink', pos: 'right-[30%] bottom-[16%]', depth: -18 },
  { name: 'Riya', className: 'bg-paper text-ink', pos: 'right-[6%] bottom-[38%]', depth: 12 },
];

function CursorTag({ name, className }) {
  return (
    <span className="flex items-start gap-0.5">
      <span className={`mt-[-2px] h-5 w-[2px] rounded-full ${className.split(' ')[0]}`} />
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{name}</span>
    </span>
  );
}

export default function FinalCta({ cta }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(`(min-width: 768px) and ${MOTION_OK}`, () => {
        const tags = q('[data-cursor]');

        // Idle drift, each at its own pace
        tags.forEach((tag, i) => {
          gsap.to(tag.firstElementChild, {
            x: 'random(-18, 18)',
            y: 'random(-14, 14)',
            duration: 'random(2.4, 3.6)',
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            repeatRefresh: true,
            delay: i * 0.3,
          });
        });

        // And a gentle parallax toward the pointer, weighted by depth
        const movers = tags.map((tag) => ({
          depth: Number(tag.dataset.depth),
          x: gsap.quickTo(tag, 'x', { duration: 1, ease: 'power3.out' }),
          y: gsap.quickTo(tag, 'y', { duration: 1, ease: 'power3.out' }),
        }));
        const panel = ref.current;
        const onMove = (e) => {
          const r = panel.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          movers.forEach((m) => {
            m.x(nx * m.depth * 2);
            m.y(ny * m.depth * 2);
          });
        };
        panel.addEventListener('pointermove', onMove);

        gsap.from(tags, {
          autoAlpha: 0,
          scale: 0.6,
          duration: 0.8,
          ease: 'back.out(2)',
          stagger: 0.12,
          scrollTrigger: { trigger: panel, start: 'top 70%', once: true },
        });

        return () => panel.removeEventListener('pointermove', onMove);
      });
    },
    { scope: ref }
  );

  return (
    <section className="pb-24 md:pb-32">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div ref={ref} className="relative overflow-hidden rounded-2xl bg-flame px-6 py-16 text-flame-ink sm:px-12 md:px-16 md:py-24">
          <div className="relative z-10 max-w-xl">
            <RevealHeading className="font-display text-[2.75rem] leading-[1.02] tracking-[-0.02em] sm:text-6xl md:text-7xl">
              Your next study session starts here.
            </RevealHeading>
            <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed opacity-85">
              Make a space, share the link, and your group is in.
            </p>
            <div className="mt-9">
              <MagneticButton to={cta.to} variant="ink">
                {cta.label}
              </MagneticButton>
            </div>
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            {CURSORS.map((c) => (
              <span key={c.name} data-cursor data-depth={c.depth} className={`absolute ${c.pos}`}>
                <span className="block">
                  <CursorTag name={c.name} className={c.className} />
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
