import type { ReactNode } from 'react';
import type { DesignState, Phase } from '../types';

export const PHASES: { id: Phase; label: string; short: string }[] = [
  { id: 'holding', label: 'Holding screen', short: 'Holding screen' },
  { id: 'after', label: 'After bridal entrance', short: 'After entrance' },
  { id: 'dancing', label: 'Dancing time', short: 'Dancing time' },
];

export function phaseLabel(p: Phase): string {
  return PHASES.find((x) => x.id === p)!.label;
}

export function PhaseSwitch({
  value,
  onChange,
  label,
}: {
  value: Phase;
  onChange: (p: Phase) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {PHASES.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          className={value === p.id ? 'active' : ''}
          onClick={() => onChange(p.id)}
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}

export interface OptionDef<T extends string> {
  id: T;
  label: string;
  hint: string;
  recommended?: boolean;
}

/** Radio cards, used for what the floor shows in each part of the night. */
export function OptionList<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: OptionDef<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="option-list" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.id} className={value === o.id ? 'option active' : 'option'}>
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span>
            <span className="option-label">
              {o.label}
              {o.recommended && <span className="badge-recommended">Recommended</span>}
            </span>
            <span className="option-hint">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** The italic gradient word used in Stomp Sphere headings. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="accent">{children}</span>;
}

export function ArrowIcon() {
  return (
    <svg className="arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 4.5V6H16.9425L4.5 18.4425L5.5575 19.5L18 7.0575V16.5H19.5V4.5H7.5Z" fill="currentColor" />
    </svg>
  );
}

export function Section({
  title,
  intro,
  children,
  className,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className ?? ''}`}>
      <h2>{title}</h2>
      {intro && <p className="muted">{intro}</p>}
      {children}
    </section>
  );
}

/** True if any part of the design other than `except` still uses this file. */
export function fileStillUsed(design: DesignState, fileId: string, except: Phase | 'media' | 'invite'): boolean {
  for (const p of PHASES) {
    if (p.id !== except && design.designs[p.id].media?.id === fileId) return true;
  }
  if (except !== 'invite' && (design.invite?.id === fileId || design.invitePreview?.id === fileId)) return true;
  if (except !== 'media' && design.media.some((m) => m.file.id === fileId)) return true;
  return false;
}
