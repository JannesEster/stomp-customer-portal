import { effectsConfig } from '../config';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState, Phase } from '../types';
import { Accent, EffectAsset, PHASES, Section } from './common';

export function ReactionsSection({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const toggle = (phase: Phase, id: string, on: boolean) =>
    update((d) => {
      const current = d.reactions[phase].filter((x) => x !== id);
      return { ...d, reactions: { ...d.reactions, [phase]: on ? [...current, id] : current } };
    });

  return (
    <Section
      title={
        <>
          Floor <Accent>reactions</Accent>
        </>
      }
      intro="Pick what appears when people walk on the floor. You can choose different reactions before and after the bridal entrance."
    >
      <div className="two-col">
        {PHASES.map((p) => (
          <fieldset key={p.id}>
            <legend>{p.label}</legend>
            <div className="effect-grid">
              {effectsConfig.effects.map((e) => {
                const checked = design.reactions[p.id].includes(e.id);
                return (
                  <label key={e.id} className={checked ? 'effect-card active' : 'effect-card'}>
                    <input type="checkbox" checked={checked} onChange={(ev) => toggle(p.id, e.id, ev.target.checked)} />
                    <EffectAsset effect={e} className="effect-preview" />
                    <span className="effect-name">{e.name}</span>
                    <span className="effect-desc">{e.description}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Section>
  );
}
