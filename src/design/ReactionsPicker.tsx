import { useState } from 'react';
import { effectsConfig, type EffectDef } from '../config';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState } from '../types';

const POPULAR = effectsConfig.effects.filter((e) => e.popular);
const MORE = effectsConfig.effects.filter((e) => !e.popular);

export function ReactionsPicker({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const pickedMore = MORE.filter((e) => design.reactions.includes(e.id)).length;

  const toggle = (id: string, on: boolean) =>
    update((d) => {
      const rest = d.reactions.filter((x) => x !== id);
      return { ...d, reactions: on ? [...rest, id] : rest };
    });

  const card = (e: EffectDef) => (
    <EffectCard
      key={e.id}
      effect={e}
      checked={design.reactions.includes(e.id)}
      playing={playing === e.id}
      onToggle={(on) => toggle(e.id, on)}
      onPlay={(on) => setPlaying((p) => (on ? e.id : p === e.id ? null : p))}
    />
  );

  return (
    <div className="reactions">
      <h4>Fantasy reactions, our most popular</h4>
      <div className="effect-grid">{POPULAR.map(card)}</div>
      <button
        type="button"
        className="secondary effect-more"
        aria-expanded={showMore}
        onClick={() => setShowMore((s) => !s)}
      >
        More reactions{pickedMore > 0 && ` (${pickedMore} picked)`}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {showMore && <div className="effect-grid">{MORE.map(card)}</div>}
    </div>
  );
}

function EffectCard({
  effect,
  checked,
  playing,
  onToggle,
  onPlay,
}: {
  effect: EffectDef;
  checked: boolean;
  playing: boolean;
  onToggle: (on: boolean) => void;
  onPlay: (on: boolean) => void;
}) {
  return (
    <label
      className={checked ? 'effect-card active' : 'effect-card'}
      onMouseEnter={() => onPlay(true)}
      onMouseLeave={() => onPlay(false)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(ev) => {
          onToggle(ev.target.checked);
          onPlay(true);
        }}
        onFocus={() => onPlay(true)}
        onBlur={() => onPlay(false)}
      />
      <span className="style-thumb">
        {playing ? (
          <video src={effect.video} poster={effect.poster} autoPlay muted loop playsInline aria-hidden />
        ) : (
          <img src={effect.poster} alt="" loading="lazy" />
        )}
      </span>
      <span className="style-name">{effect.name}</span>
      <span className="effect-desc">{effect.description}</span>
      {effect.fillsFloor && <span className="style-tag">Fills the whole floor</span>}
    </label>
  );
}
