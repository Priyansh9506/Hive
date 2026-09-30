import React, { useRef } from 'react';
import { FolderPlus, Pin, UserPlus, Users } from 'lucide-react';
import { gsap, useGSAP, ScrollTrigger, MOTION_OK } from './gsap';
import { RevealHeading } from './primitives';

const STEPS = [
  {
    icon: FolderPlus,
    title: 'Create',
    body: 'Make a space for one exam, topic or project. A name and a subject is all it needs.',
    detail: <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs">Thermodynamics, Unit 3</span>,
  },
  {
    icon: UserPlus,
    title: 'Invite',
    body: 'Share an invite link or code. Classmates who are not signed in yet land in the space right after they do.',
    detail: <span className="rounded-full border border-line bg-surface px-3 py-1 font-geist-mono text-xs">/join/K7Q2MX</span>,
  },
  {
    icon: Users,
    title: 'Work together',
    body: 'Write notes side by side, talk it through in chat, and drop in files as you go.',
    detail: (
      <span className="flex -space-x-1.5">
        {['M', 'A', 'R', 'K'].map((initial, i) => (
          <span
            key={initial}
            className={`grid size-7 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-paper ${i === 0 ? 'bg-flame text-flame-ink' : i === 1 ? 'bg-ink text-paper' : 'border border-line bg-sunk text-ink'}`}
          >
            {initial}
          </span>
        ))}
      </span>
    ),
  },
  {
    icon: Pin,
    title: 'Keep what matters',
    body: 'Pin answers, highlight key lines and save versions, so the space is still useful the week after.',
    detail: (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs">
        <Pin size={12} strokeWidth={2} className="text-flame" />3 pinned answers
      </span>
    ),
  },
];

/**
 * The four-step flow. A progress rail fills as you read down, and each step
 * lights up as it reaches the middle of the screen, so the reader always knows
 * where they are in the sequence.
 */
export default function HowItWorks() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          q('[data-rail]'),
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: { trigger: q('[data-steps]')[0], start: 'top 55%', end: 'bottom 55%', scrub: 0.6 },
          }
        );

        q('[data-step]').forEach((step) => {
          step.dataset.active = 'false';
          ScrollTrigger.create({
            trigger: step,
            start: 'top 58%',
            onToggle: (self) => {
              step.dataset.active = String(self.isActive);
            },
          });
        });

        return () => q('[data-step]').forEach((step) => delete step.dataset.active);
      });
    },
    { scope: ref }
  );

  return (
    <section id="how" ref={ref} className="scroll-mt-20 border-t border-line py-24 md:py-32">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <RevealHeading className="font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl">
              From empty room to exam-ready in four moves.
            </RevealHeading>
            <p className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-ink-soft">
              No setup, no workspace admin. If you can share a link, you can run a study group.
            </p>
          </div>
        </div>

        <ol data-steps className="relative lg:col-span-6 lg:col-start-7">
          {/* Rail: the track, then the accent fill that follows the scroll */}
          <span aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-px bg-line" />
          <span aria-hidden="true" data-rail className="absolute bottom-6 left-[19px] top-6 w-px origin-top bg-flame" />

          {STEPS.map(({ icon: Icon, title, body, detail }) => (
            <li key={title} data-step className="group relative flex gap-6 pb-16 last:pb-0">
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-soft transition-colors duration-500 group-data-[active=true]:border-flame group-data-[active=true]:bg-flame group-data-[active=true]:text-flame-ink">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <div className="pt-1 transition-opacity duration-500 group-data-[active=false]:opacity-35">
                <h3 className="font-display text-3xl leading-tight md:text-4xl">{title}</h3>
                <p className="mt-2 max-w-[44ch] text-[16px] leading-relaxed text-ink-soft">{body}</p>
                <div className="mt-4">{detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
