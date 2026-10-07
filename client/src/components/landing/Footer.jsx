import React from 'react';
import { Link } from 'react-router-dom';
import { scrollToSection } from './gsap';
import { Wordmark } from './primitives';

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'faq', label: 'FAQ' },
];

const linkClass = 'text-sm text-ink-soft transition-colors hover:text-ink';

export default function Footer({ cta }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-10 px-4 py-14 sm:px-6 md:grid-cols-12">
        <div className="col-span-2 md:col-span-6">
          <Wordmark />
          <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-ink-soft">
            A shared study room for your group: live notes, chat, files and an AI tutor in one place.
          </p>
        </div>

        <nav aria-label="Product" className="md:col-span-3">
          <p className="text-sm font-medium">Product</p>
          <ul className="mt-4 space-y-3">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(s.id);
                  }}
                  className={linkClass}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account" className="md:col-span-3">
          <p className="text-sm font-medium">Account</p>
          <ul className="mt-4 space-y-3">
            {!cta.authed && (
              <li>
                <Link to="/login" className={linkClass}>
                  Log in
                </Link>
              </li>
            )}
            <li>
              <Link to={cta.to} className={linkClass}>
                {cta.label}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-[1240px] border-t border-line px-4 py-6 text-xs text-ink-faint sm:px-6">
        &copy; {new Date().getFullYear()} Hive
      </div>
    </footer>
  );
}
