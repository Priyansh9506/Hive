import React from 'react';
import { Sun, Monitor, Moon } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** Three-way light / system / dark switch. Lives inside a `.landing` themed root. */
export default function ThemeToggle({ theme, onChange }) {
  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex items-center gap-0.5 p-0.5 rounded-full border border-line bg-sunk">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => onChange(value)}
            className={`grid place-items-center size-7 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-flame ${
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
            }`}
          >
            <Icon size={14} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
