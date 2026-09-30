import React, { useRef } from 'react';
import { gsap, useGSAP, SplitText, MOTION_OK } from './gsap';

/**
 * The problem statement, read at the pace of the scroll: each word fills in as
 * you move down, so the sentence lands one idea at a time.
 */
export default function Manifesto() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const text = ref.current.querySelector('[data-manifesto]');
        SplitText.create(text, {
          type: 'words',
          autoSplit: true,
          onSplit: (self) =>
            gsap.fromTo(
              self.words,
              { opacity: 0.14 },
              {
                opacity: 1,
                ease: 'none',
                stagger: 0.1,
                scrollTrigger: { trigger: text, start: 'top 78%', end: 'bottom 50%', scrub: 0.5 },
              }
            ),
        });
      });
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="py-28 md:py-40">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <p
          data-manifesto
          className="max-w-5xl font-display text-[2.5rem] leading-[1.08] tracking-[-0.02em] sm:text-6xl lg:text-7xl"
        >
          Group study shouldn&apos;t mean scrolling back through the chat to find{' '}
          <span className="italic text-flame">the one answer</span> that mattered.
        </p>
      </div>
    </section>
  );
}
