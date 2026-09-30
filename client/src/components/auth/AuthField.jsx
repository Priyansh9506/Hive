import React, { useId, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { gsap } from '../landing/gsap';

/**
 * Label above, input, then helper or error text below, all wired together for
 * screen readers. Password fields get a show / hide toggle.
 */
export default function AuthField({ label, type = 'text', error, helper, className = '', ...inputProps }) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const iconRef = useRef(null);
  const isPassword = type === 'password';
  const describedBy = error || helper ? `${id}-note` : undefined;

  const toggle = () => {
    setRevealed((v) => !v);
    // A quick squash on the eye so the switch registers
    if (iconRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(iconRef.current, { scale: 0.6, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.45, ease: 'back.out(3)' });
    }
  };

  return (
    <div data-auth-item className={`grid gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-faint focus:outline-none focus:ring-4 disabled:opacity-60 ${
            error
              ? 'border-flame focus:border-flame focus:ring-flame/20'
              : 'border-line hover:border-ink-faint/50 focus:border-flame focus:ring-flame/15'
          } ${isPassword ? 'pr-11' : ''}`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={toggle}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-flame"
          >
            <span ref={iconRef} className="grid place-items-center">
              {revealed ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
            </span>
          </button>
        )}
      </div>
      {(error || helper) && (
        <p id={`${id}-note`} className={`text-[13px] ${error ? 'text-flame' : 'text-ink-faint'}`}>
          {error || helper}
        </p>
      )}
    </div>
  );
}
