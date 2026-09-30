import React, { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { gsap, useGSAP } from './gsap';
import { RevealHeading } from './primitives';

const QUESTIONS = [
  {
    q: 'What happens if my Wi-Fi drops mid-edit?',
    a: 'Keep typing. Your edits are kept and merge back in when you reconnect. The notes run on Yjs, a CRDT, so nobody overwrites anybody else.',
  },
  {
    q: 'How do classmates join a space?',
    a: 'Send them the invite link or code. If they are not signed in yet, they sign in (email or Google) and land straight in the space.',
  },
  {
    q: 'What can the AI assistant do?',
    a: 'Answer questions about your notes, summarize the chat, write a quiz, explain a passage, or turn notes into revision notes. It runs on Google Gemini.',
  },
  {
    q: 'What can I add as a resource?',
    a: 'Files up to 10 MB, links, and code snippets with their language. Everything stays attached to the space it was shared in.',
  },
  {
    q: 'Can I undo a bad edit?',
    a: 'Yes. Open version history, read any saved version in full, and restore it for everyone in the space.',
  },
];

function Item({ q, a, open, onToggle }) {
  const panel = useRef(null);
  const icon = useRef(null);
  // Starting styles only; after mount GSAP owns height and opacity
  const [initial] = useState(() => ({ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }));
  const id = useId();

  // Height is the one non-transform property animated on the page: an
  // accordion has to push the rows below it down.
  useGSAP(
    () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const d = reduce ? 0 : 1;
      gsap.to(panel.current, { height: open ? 'auto' : 0, duration: 0.55 * d, ease: 'power3.inOut' });
      gsap.to(panel.current.firstElementChild, {
        autoAlpha: open ? 1 : 0,
        y: open ? 0 : -8,
        duration: 0.4 * d,
        delay: open ? 0.12 * d : 0,
      });
      gsap.to(icon.current, { rotate: open ? 45 : 0, duration: 0.45 * d, ease: 'back.out(2)' });
    },
    { dependencies: [open] }
  );

  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="group flex w-full items-center justify-between gap-6 py-6 text-left"
        >
          <span className="text-lg font-medium tracking-tight transition-colors group-hover:text-flame md:text-xl">{q}</span>
          <span
            ref={icon}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-flame/50 group-hover:text-flame"
          >
            <Plus size={16} strokeWidth={1.75} />
          </span>
        </button>
      </h3>
      <div id={id} ref={panel} role="region" style={{ height: initial.height }} className="overflow-hidden">
        <p style={{ opacity: initial.opacity }} className="max-w-[60ch] pb-6 pr-12 text-[16px] leading-relaxed text-ink-soft">
          {a}
        </p>
      </div>
    </div>
  );
}

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="scroll-mt-20 border-t border-line py-24 md:py-32">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <RevealHeading className="font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Before you ask.
          </RevealHeading>
        </div>
        <div className="border-t border-line lg:col-span-8">
          {QUESTIONS.map((item, i) => (
            <Item key={item.q} {...item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
