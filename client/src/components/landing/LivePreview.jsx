import React, { useRef } from 'react';
import { FileText, MessageSquare, Paperclip, Pin, Sparkles, SendHorizontal } from 'lucide-react';
import { gsap, useGSAP, ScrollTrigger, MOTION_OK } from './gsap';
import { Caret } from './primitives';

// What the two classmates type into the shared notes during the demo
const MEERA_LINE = 'Entropy of an isolated system never decreases: ';
const MEERA_FORMULA = 'ΔS ≥ 0';
const AARAV_LINE = 'Example: ice melting in your palm.';
const AI_PROMPT = 'Quiz me on the second law';

const PEOPLE = [
  { initial: 'M', name: 'Meera', className: 'bg-flame text-flame-ink' },
  { initial: 'A', name: 'Aarav', className: 'bg-ink text-paper' },
  { initial: 'R', name: 'Riya', className: 'bg-sunk text-ink border border-line' },
];

const TABS = [
  { label: 'Notes', icon: FileText, active: true },
  { label: 'Chat', icon: MessageSquare },
  { label: 'Resources', icon: Paperclip },
  { label: 'AI', icon: Sparkles },
];

/**
 * A working miniature of a Kolo space, replaying one short session: two
 * classmates type into the same notes, a question gets answered and pinned in
 * chat, a line is highlighted, and the AI turns the notes into a quiz. It shows
 * the product doing its job instead of describing it.
 */
export default function LivePreview() {
  const ref = useRef(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();

      mm.add(
        { motion: MOTION_OK, reduce: '(prefers-reduced-motion: reduce)' },
        (ctx) => {
          const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6, defaults: { ease: 'power3.out' } });

          tl.set(q('[data-type]'), { text: '' })
            .set(q('[data-caret]'), { autoAlpha: 0 })
            .set(q('[data-msg], [data-typing], [data-pin-chip], [data-quiz]'), { autoAlpha: 0, y: 10 })
            .set(q('[data-pin]'), { autoAlpha: 0, scale: 0, rotate: -40 })
            .set(q('[data-mark]'), { scaleX: 0 })

            // Two people typing into the same paragraph block at once
            .to(q('[data-caret="meera"]'), { autoAlpha: 1, duration: 0.2 }, 0.3)
            .to(q('[data-type="meera"]'), { text: MEERA_LINE, duration: 2.2, ease: 'none' }, 0.4)
            .to(q('[data-type="formula"]'), { text: MEERA_FORMULA, duration: 0.4, ease: 'none' }, '>')
            .to(q('[data-caret="aarav"]'), { autoAlpha: 1, duration: 0.2 }, 1.1)
            .to(q('[data-type="aarav"]'), { text: AARAV_LINE, duration: 2.8, ease: 'none' }, 1.2)

            // Chat: a question, someone typing, the answer, then it gets pinned
            .to(q('[data-msg="q"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, 2.2)
            .to(q('[data-typing]'), { autoAlpha: 1, y: 0, duration: 0.3 }, 3.0)
            .to(q('[data-typing]'), { autoAlpha: 0, duration: 0.2 }, 4.1)
            .to(q('[data-msg="a"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, 4.2)
            .to(q('[data-pin]'), { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)' }, 5.0)
            .to(q('[data-pin-chip]'), { autoAlpha: 1, y: 0, duration: 0.45 }, 5.2)

            // Key formula highlighted in the notes
            .to(q('[data-mark]'), { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, 5.6)

            // AI: prompt typed, quiz ready
            .to(q('[data-type="ai"]'), { text: AI_PROMPT, duration: 1.2, ease: 'none' }, 6.3)
            .to(q('[data-quiz]'), { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, 7.8)
            .addLabel('done', 8.3)

            // Hold the finished state, then clear the board for the next loop
            .to(q('[data-fade]'), { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, '+=3.2');

          if (ctx.conditions.reduce) {
            // No playback: show the finished session
            tl.seek('done').pause();
            return;
          }

          // Only run while the preview is on screen; start after the hero intro
          const delayed = gsap.delayedCall(1.3, () => {
            ScrollTrigger.create({
              trigger: ref.current,
              start: 'top bottom',
              end: 'bottom top',
              onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
            });
          });

          gsap.from(ref.current, { autoAlpha: 0, y: 40, scale: 0.97, duration: 1.3, delay: 0.45, ease: 'expo.out' });
          return () => delayed.kill();
        }
      );
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      aria-label="Preview of a Kolo study space: classmates editing notes together, chatting, and using the AI assistant"
      role="img"
      className="ls-lift relative overflow-hidden rounded-2xl border border-line bg-surface text-left"
    >
      {/* Space header */}
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Thermodynamics, Unit 3</p>
          <p className="text-xs text-ink-faint">ME201 end-sem group</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1.5">
            {PEOPLE.map((p) => (
              <span
                key={p.name}
                title={p.name}
                className={`grid size-7 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-surface ${p.className}`}
              >
                {p.initial}
              </span>
            ))}
          </div>
          <span className="hidden text-xs text-ink-faint sm:inline">3 here</span>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1 border-b border-line px-3 py-2 sm:px-4">
        {TABS.map(({ label, icon: Icon, active }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${active ? 'bg-sunk font-medium text-ink' : 'text-ink-faint'}`}
          >
            <Icon size={13} strokeWidth={1.75} />
            {label}
          </span>
        ))}
      </div>

      <div className="grid h-[330px] grid-cols-1 sm:h-[310px] sm:grid-cols-[1.45fr_1fr]">
        {/* Shared notes */}
        <div className="overflow-hidden px-4 pt-5 sm:px-6">
          <h3 className="font-display text-[26px] leading-tight">Second law, in plain words</h3>
          <p className="mt-3 text-[13.5px] leading-6 text-ink-soft">
            Heat moves on its own from hot to cold, never the other way round.
          </p>
          <p className="mt-4 min-h-14 text-[13.5px] leading-6 text-ink-soft">
            <span data-fade>
              <span data-type="meera">{MEERA_LINE}</span>
              <span className="relative inline-block font-medium text-ink">
                <span
                  data-mark
                  aria-hidden="true"
                  className="absolute -inset-x-1 inset-y-0.5 origin-left rounded bg-flame-wash"
                />
                <span data-type="formula" className="relative">{MEERA_FORMULA}</span>
              </span>
            </span>
            <span data-fade>
              <Caret name="Meera" tone="flame" dataKey="meera" />
            </span>
          </p>
          <p className="mt-4 min-h-14 text-[13.5px] leading-6 text-ink-soft">
            <span data-fade>
              <span data-type="aarav">{AARAV_LINE}</span>
              <Caret name="Aarav" tone="ink" dataKey="aarav" />
            </span>
          </p>
        </div>

        {/* Chat */}
        <div className="hidden flex-col border-l border-line bg-paper/60 px-3.5 py-4 sm:flex">
          <div
            data-pin-chip
            data-fade
            className="mb-3 flex items-center gap-1.5 self-start rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-soft"
          >
            <Pin size={11} strokeWidth={2} className="text-flame" />
            1 pinned answer
          </div>

          <div className="flex flex-col gap-2.5">
            <div data-msg="q" data-fade className="max-w-[92%] self-start">
              <p className="mb-1 text-[10.5px] text-ink-faint">Riya</p>
              <p className="rounded-2xl rounded-tl-md bg-surface px-3 py-2 text-[12.5px] leading-5 ring-1 ring-line">
                Is ΔS positive for the melting ice?
              </p>
            </div>

            <div data-msg="a" data-fade className="relative max-w-[92%] self-start">
              <p className="mb-1 text-[10.5px] text-ink-faint">Aarav</p>
              <p className="rounded-2xl rounded-tl-md bg-surface px-3 py-2 text-[12.5px] leading-5 ring-1 ring-flame/50">
                Yes. Q goes in, so Q/T &gt; 0. Slide 14 has it.
              </p>
              <span
                data-pin
                className="absolute -right-2 top-4 grid size-6 place-items-center rounded-full bg-flame text-flame-ink"
              >
                <Pin size={12} strokeWidth={2.25} />
              </span>
            </div>

            <p data-typing data-fade className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              Meera is typing
              <span className="flex gap-0.5">
                <span className="size-1 animate-pulse rounded-full bg-ink-faint" />
                <span className="size-1 animate-pulse rounded-full bg-ink-faint [animation-delay:150ms]" />
                <span className="size-1 animate-pulse rounded-full bg-ink-faint [animation-delay:300ms]" />
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* AI bar */}
      <div className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-flame-wash text-flame">
          <Sparkles size={14} strokeWidth={1.75} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-ink">
          <span data-fade>
            <span data-type="ai">{AI_PROMPT}</span>
          </span>
        </p>
        <span
          data-quiz
          data-fade
          className="hidden shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper sm:inline"
        >
          5 questions ready
        </span>
        <SendHorizontal size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
      </div>
    </div>
  );
}
