import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap, useGSAP, ScrollTrigger, MOTION_OK, scrollToSection } from './gsap';
import { MagneticButton, Wordmark } from './primitives';

const LINKS = [
  { id: 'features', label: 'Product' },
  { id: 'how', label: 'How it works' },
  { id: 'faq', label: 'FAQ' },
];

export default function Nav({ cta }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      // Transparent over the hero, frosted once the page moves under it
      // (A start/end range would switch off again at the very bottom of the
      // page, so the scroll position is read directly instead.)
      const setStuck = (self) => {
        ref.current.dataset.stuck = self.scroll() > 16;
      };
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: setStuck, onRefresh: setStuck });

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(ref.current.children, { autoAlpha: 0, y: -10, duration: 0.7, delay: 0.1, stagger: 0.06 });
      });
    },
    { scope: ref }
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div
        ref={ref}
        data-stuck="false"
        className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-4 transition-[background-color,border-color,backdrop-filter] duration-300 sm:px-6 lg:mt-3 lg:h-14 lg:rounded-full lg:border lg:border-transparent lg:pl-5 lg:pr-2 data-[stuck=true]:border-b data-[stuck=true]:border-line data-[stuck=true]:bg-paper/90 data-[stuck=true]:backdrop-blur-xl lg:data-[stuck=true]:border lg:data-[stuck=true]:bg-surface/90"
      >
        <Link to="/" aria-label="StudySync home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(link.id);
              }}
              className="group relative rounded-full px-3.5 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
              <span className="absolute inset-x-3.5 bottom-1.5 h-px origin-left scale-x-0 bg-flame transition-transform duration-300 ease-out group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {!cta.authed && (
            <Link to="/login" className="rounded-full px-3 py-2 text-sm text-ink-soft transition-colors hover:text-ink">
              Log in
            </Link>
          )}
          <MagneticButton to={cta.to} variant="ink" size="sm" strength={0.2}>
            {cta.label}
          </MagneticButton>
        </div>
      </div>
    </header>
  );
}
