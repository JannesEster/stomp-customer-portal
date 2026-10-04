import type { CSSProperties, ReactNode } from 'react';
import type { EffectDef } from '../config';
import type { DesignState, Phase } from '../types';

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'pre', label: 'Pre-bridal' },
  { id: 'post', label: 'Post-bridal' },
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
          {p.label}
        </button>
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

/** Renders an effect's preview asset from config, image or video. */
export function EffectAsset({
  effect,
  className,
  style,
}: {
  effect: EffectDef;
  className?: string;
  style?: CSSProperties;
}) {
  if (effect.preview.type === 'video') {
    return (
      <video className={className} style={style} src={effect.preview.src} autoPlay muted loop playsInline aria-hidden />
    );
  }
  return <img className={className} style={style} src={effect.preview.src} alt="" draggable={false} />;
}

/** True if any part of the design other than `except` still uses this file. */
export function fileStillUsed(design: DesignState, fileId: string, except: 'pre' | 'post' | 'media' | 'invite'): boolean {
  if (except !== 'pre' && design.holding.pre.photo.file?.id === fileId) return true;
  if (except !== 'post' && design.holding.post.photo.file?.id === fileId) return true;
  if (except !== 'invite' && design.invite?.id === fileId) return true;
  if (except !== 'media' && design.media.some((m) => m.file.id === fileId)) return true;
  return false;
}
