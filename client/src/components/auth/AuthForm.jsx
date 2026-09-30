import React from 'react';
import { CircleAlert } from 'lucide-react';

/** Full-width primary action, in the landing page's pill style. */
export function SubmitButton({ loading, children, loadingLabel }) {
  return (
    <button
      data-auth-item
      type="submit"
      disabled={loading}
      aria-busy={loading || undefined}
      className="group relative h-12 w-full overflow-hidden rounded-full bg-flame text-[15px] font-medium text-flame-ink transition-[transform,opacity] duration-200 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame active:scale-[0.98] disabled:cursor-progress"
    >
      {/* Soft sheen sweeping across while the request is in flight */}
      {loading && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/2 w-1/2 animate-[ls-sheen_1.1s_ease-in-out_infinite] bg-linear-to-r from-transparent via-white/25 to-transparent motion-reduce:hidden"
        />
      )}
      <span className="relative">{loading ? loadingLabel : children}</span>
    </button>
  );
}

/** Form-level error from the server, announced to screen readers. */
export function FormAlert({ message }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-flame/30 bg-flame-wash px-3.5 py-3 text-sm text-ink"
    >
      <CircleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-flame" />
      {message}
    </p>
  );
}
