import React, { useRef } from 'react';
import { Code, FileText, Link2, Pin, RotateCcw, Sparkles } from 'lucide-react';
import { gsap, useGSAP, ScrollTrigger, MOTION_OK, trackSpot } from './gsap';
import { Caret, RevealHeading } from './primitives';

/* Shared shell for every tile: spotlight hover, copy block, demo slot. */
function Tile({ className = '', title, body, children, id, tone = 'surface' }) {
  const tones = {
    surface: 'bg-surface border border-line',
    ink: 'bg-ink text-paper',
    wash: 'bg-flame-wash border border-flame/15',
  };
  const bodyTone = tone === 'ink' ? 'text-paper/65' : 'text-ink-soft';
  return (
    <article
      id={id}
      data-tile
      onPointerMove={trackSpot}
      className={`ls-spot group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl ${tones[tone]} ${className}`}
    >
      <div className="relative flex-1 p-3">{children}</div>
      <div className="px-6 pb-6 pt-2 sm:px-7 sm:pb-7">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className={`mt-1.5 max-w-[46ch] text-[15px] leading-relaxed ${bodyTone}`}>{body}</p>
      </div>
    </article>
  );
}

/* Live notes: two carets write into one document. Replays on hover. */
function NotesDemo() {
  const ref = useRef(null);
  const tl = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        tl.current = gsap
          .timeline({ scrollTrigger: { trigger: ref.current, start: 'top 75%', once: true } })
          .from(q('[data-type="a"]'), { text: '', duration: 1.6, ease: 'none' }, 0.2)
          .from(q('[data-type="b"]'), { text: '', duration: 1.3, ease: 'none' }, 0.6);
      });
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      onPointerEnter={() => tl.current?.progress() === 1 && tl.current.restart()}
      className="ls-dots flex h-full min-h-56 items-center justify-center rounded-xl bg-sunk/60 p-5 sm:p-8"
    >
      <div className="ls-lift w-full max-w-md rounded-xl border border-line bg-surface px-5 py-5 text-[14px] leading-7 text-ink-soft transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
        <p className="font-display text-[22px] leading-tight text-ink">DBMS: normal forms</p>
        <p className="mt-2">1NF: every column holds a single value.</p>
        <p className="mt-4 min-h-7">
          2NF: <span data-type="a">no partial dependency on part of a key.</span>
          <Caret name="Meera" tone="flame" />
        </p>
        <p className="mt-4 min-h-7">
          3NF: <span data-type="b">no transitive dependency.</span>
          <Caret name="Aarav" tone="ink" />
        </p>
      </div>
    </div>
  );
}

const AI_TOOLS = ['Ask', 'Summarize', 'Quiz', 'Explain', 'Revision notes'];
const AI_ANSWER = 'Every column depends on the key, the whole key, and nothing but the key.';

/* AI: the answer decodes into place the first time it is seen, and on hover. */
function AiDemo() {
  const ref = useRef(null);
  const play = useRef(() => {});

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const scramble = () =>
          gsap.fromTo(
            q('[data-answer]'),
            { autoAlpha: 0.4 },
            {
              autoAlpha: 1,
              duration: 1.6,
              scrambleText: { text: AI_ANSWER, chars: 'lowerCase', speed: 0.6, revealDelay: 0.2 },
            }
          );
        gsap.set(q('[data-answer]'), { text: '' });
        ScrollTrigger.create({ trigger: ref.current, start: 'top 75%', once: true, onEnter: scramble });
        play.current = scramble;
        return () => {
          play.current = () => {};
        };
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} onPointerEnter={() => play.current()} className="flex h-full min-h-56 flex-col justify-center gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        {AI_TOOLS.map((tool) => (
          <span
            key={tool}
            className={`rounded-full px-2.5 py-1 text-xs ${tool === 'Explain' ? 'bg-flame font-medium text-flame-ink' : 'bg-paper/10 text-paper/70'}`}
          >
            {tool}
          </span>
        ))}
      </div>
      <p className="self-end rounded-2xl rounded-br-md bg-paper/10 px-3.5 py-2 text-sm">Explain 3NF like I&apos;m half asleep</p>
      <div className="flex gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-flame text-flame-ink">
          <Sparkles size={14} strokeWidth={1.75} />
        </span>
        <p data-answer className="min-h-12 max-w-[34ch] text-sm leading-6 text-paper/90">
          {AI_ANSWER}
        </p>
      </div>
    </div>
  );
}

const CHAT = [
  { who: 'Kabir', text: 'which normal form is this table in?' },
  { who: 'Riya', text: '2NF. Roll no → name is a partial dependency.', pinned: true },
  { who: 'Ishaan', text: 'ohh, that makes sense now' },
];

/* Pins: hovering the tile lifts the answer out of the thread and pins it. */
function PinsDemo() {
  const ref = useRef(null);
  const tl = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        tl.current = gsap
          .timeline({ paused: true, defaults: { ease: 'power3.out' } })
          .to(q('[data-row="rest"]'), { autoAlpha: 0.45, duration: 0.3 }, 0)
          .to(q('[data-row="pinned"]'), { y: -6, scale: 1.04, duration: 0.45 }, 0)
          .fromTo(
            q('[data-pin]'),
            { autoAlpha: 0, y: -18, rotate: -35 },
            { autoAlpha: 1, y: 0, rotate: 0, duration: 0.55, ease: 'bounce.out' },
            0.1
          );
        gsap.set(q('[data-pin]'), { autoAlpha: 0 });
      });
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      onPointerEnter={() => tl.current?.play()}
      onPointerLeave={() => tl.current?.reverse()}
      className="flex h-full min-h-56 flex-col justify-center gap-2 px-3 py-5 sm:px-5"
    >
      {CHAT.map((m) => (
        <div
          key={m.who}
          data-row={m.pinned ? 'pinned' : 'rest'}
          className={`relative rounded-xl bg-surface px-3.5 py-2.5 ${m.pinned ? 'ring-1 ring-flame/40' : ''}`}
        >
          <p className="text-[11px] text-ink-faint">{m.who}</p>
          <p className="text-[13px] leading-5">{m.text}</p>
          {m.pinned && (
            <span data-pin className="absolute -right-1.5 -top-2 grid size-6 place-items-center rounded-full bg-flame text-flame-ink">
              <Pin size={12} strokeWidth={2.25} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const FILES = [
  { icon: FileText, name: 'Unit 3 slides.pdf', meta: 'PDF, 2.4 MB' },
  { icon: Link2, name: 'Normalization lecture', meta: 'youtube.com' },
  { icon: Code, name: 'normalize.sql', meta: 'SQL snippet' },
];

/* Resources: a tidy stack that fans out on hover. */
function ResourcesDemo() {
  const ref = useRef(null);
  const tl = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      // Stacking needs the absolute layout used from md up; phones get a list
      mm.add(`(min-width: 768px) and ${MOTION_OK}`, () => {
        const cards = q('[data-file]');
        // At rest the first file sits on top with the others peeking out
        // below it; on hover the stack fans open so all three can be read
        gsap.set(cards, { y: (i) => i * 12 - 12, scale: (i) => 1 - i * 0.06, transformOrigin: '50% 100%' });
        tl.current = gsap
          .timeline({ paused: true, defaults: { duration: 0.6, ease: 'back.out(1.6)' } })
          .to(cards, { y: (i) => (i - 1) * 60, scale: 1, rotate: (i) => (i - 1) * 3 }, 0);
      });
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      onPointerEnter={() => tl.current?.play()}
      onPointerLeave={() => tl.current?.reverse()}
      className="ls-dots relative flex h-full min-h-56 items-center justify-center overflow-hidden rounded-xl"
    >
      <div className="relative grid w-full max-w-[250px] gap-2.5 md:block md:h-14">
        {FILES.map(({ icon: Icon, name, meta }, i) => (
          <div
            key={name}
            data-file
            style={{ zIndex: FILES.length - i }}
            className="ls-lift flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 md:absolute md:inset-x-0"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-flame-wash text-flame">
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{name}</span>
              <span className="block text-[11px] text-ink-faint">{meta}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const VERSIONS = [
  { at: 'Mon, 18:05', note: 'First draft' },
  { at: 'Mon, 21:40', note: 'Added 1NF to 3NF' },
  { at: 'Tue, 10:12', note: 'Riya fixed the 2NF example' },
  { at: 'Tue, 16:30', note: 'BCNF section' },
  { at: 'Tue, 22:55', note: 'Worked answers for Q1-Q4' },
  { at: 'Wed, 08:20', note: 'Final pass before the exam' },
];

/* Versions: move across the timeline to scrub through saved snapshots. */
function VersionsDemo() {
  const ref = useRef(null);
  const api = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const track = q('[data-track]')[0];
      const marker = q('[data-marker]')[0];
      const at = q('[data-at]')[0];
      const note = q('[data-note]')[0];
      const dots = q('[data-dot]');
      const last = VERSIONS.length - 1;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // The marker layer is as wide as the track, so xPercent 0-100 walks the
      // handle from the first snapshot to the last at any width
      const moveTo = gsap.quickTo(marker, 'xPercent', { duration: reduce ? 0 : 0.5, ease: 'power3.out' });
      let current = -1;

      const show = (i) => {
        moveTo((i / last) * 100);
        if (i === current) return;
        current = i;
        at.textContent = VERSIONS[i].at;
        note.textContent = VERSIONS[i].note;
        dots.forEach((d, k) => d.classList.toggle('bg-flame', k <= i));
        if (!reduce) gsap.fromTo([at, note], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.04 });
      };

      api.current = {
        fromPointer: (e) => {
          const r = track.getBoundingClientRect();
          const ratio = gsap.utils.clamp(0, 1, (e.clientX - r.left) / r.width);
          show(Math.round(ratio * last));
        },
        reset: () => show(last),
      };
      gsap.set(marker, { xPercent: 100 });
      show(last);
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      onPointerMove={(e) => api.current?.fromPointer(e)}
      onPointerDown={(e) => api.current?.fromPointer(e)}
      onPointerLeave={() => api.current?.reset()}
      className="flex h-full min-h-56 touch-pan-y flex-col justify-center gap-7 px-4 py-6 sm:px-8"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p data-at className="font-geist-mono text-xs text-ink-faint">
            {VERSIONS[VERSIONS.length - 1].at}
          </p>
          <p data-note className="mt-1 truncate text-[15px] font-medium">
            {VERSIONS[VERSIONS.length - 1].note}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors group-hover:border-flame/40 group-hover:text-ink">
          <RotateCcw size={13} strokeWidth={1.75} />
          Restore
        </span>
      </div>

      <div data-track className="relative mx-2 h-px bg-line">
        {VERSIONS.map((v, i) => (
          <span
            key={v.at}
            data-dot
            style={{ left: `${(i / (VERSIONS.length - 1)) * 100}%` }}
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line transition-colors duration-300"
          />
        ))}
        <span data-marker className="pointer-events-none absolute inset-0">
          <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full border-2 border-flame bg-surface shadow-sm" />
        </span>
      </div>
    </div>
  );
}

export default function Features() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from('[data-tile]', {
          autoAlpha: 0,
          y: 48,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.08,
          clearProps: 'transform,opacity,visibility',
          scrollTrigger: { trigger: '[data-grid]', start: 'top 82%', once: true },
        });
      });
    },
    { scope: ref }
  );

  return (
    <section id="features" ref={ref} className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="max-w-2xl">
          <RevealHeading className="font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl md:text-6xl">
            Built for the night before the exam.
          </RevealHeading>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
            One space per subject, exam or project. Everyone in it sees the same notes, chat and files as they change.
          </p>
        </div>

        <div data-grid className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4">
          <Tile
            className="md:col-span-7"
            title="Write the notes together"
            body="Everyone edits one document at once. Changes merge on their own, even after your Wi-Fi drops."
          >
            <NotesDemo />
          </Tile>
          <Tile
            id="ai"
            tone="ink"
            className="md:col-span-5"
            title="An AI tutor that has read your notes"
            body="Ask questions, get a quiz, or turn a messy page into revision notes. Powered by Google Gemini."
          >
            <AiDemo />
          </Tile>
          <Tile
            tone="wash"
            className="md:col-span-4"
            title="Answers that stay found"
            body="Pin the message that solved it and highlight the lines that matter, so late joiners catch up fast."
          >
            <PinsDemo />
          </Tile>
          <Tile
            className="md:col-span-3"
            title="Files, links and code"
            body="Lecture PDFs, useful links and code snippets, kept inside the space."
          >
            <ResourcesDemo />
          </Tile>
          <Tile
            className="md:col-span-5"
            title="Every save is a checkpoint"
            body="Notes are saved as you work. Open any version and restore it for the whole group."
          >
            <VersionsDemo />
          </Tile>
        </div>
      </div>
    </section>
  );
}
