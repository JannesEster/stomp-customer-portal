import type { UpdateDesign } from '../hooks/useDesignState';
import type { AfterEntranceMode, DancingMode, DesignState, Phase } from '../types';
import { Accent, OptionList, PHASES, Section, type OptionDef } from './common';
import { CouplePhoto, HoldingFields, NamesField, StylePicker } from './HoldingFields';
import { InviteUpload } from './InviteUpload';
import { ReactionsPicker } from './ReactionsPicker';
import { DancingVideosStrip } from './DancingVideosStrip';

const AFTER_OPTIONS: OptionDef<AfterEntranceMode>[] = [
  {
    id: 'same',
    label: 'Keep the holding screen',
    hint: 'Your holding screen and its reactions stay on until dancing time.',
    recommended: true,
  },
  { id: 'different', label: 'Use a different style', hint: 'Pick a second design to show until dancing time.' },
];

const DANCING_OPTIONS: OptionDef<DancingMode>[] = [
  {
    id: 'blank',
    label: 'Blank floor with assorted reactions',
    hint: 'The floor goes dark and keeps changing through a mix of reactions as people dance.',
    recommended: true,
  },
  {
    id: 'videos',
    label: 'Colourful videos',
    hint: 'Bright moving visuals, like neon tunnels, golden swirls and kaleidoscopes, play across the floor.',
  },
  {
    id: 'different',
    label: 'Use a different style',
    hint: 'Show a design while people dance. A busy design can make the reactions harder to see.',
  },
];

export function FloorDesignSection({
  design,
  update,
  phase,
  onPhaseChange,
  eventDate,
}: {
  design: DesignState;
  update: UpdateDesign;
  phase: Phase;
  onPhaseChange: (p: Phase) => void;
  eventDate: string;
}) {
  /** A second design starts with the holding screen's names and photo, but the couple picks a new style. */
  const startDesign = (d: DesignState, target: 'after' | 'dancing') =>
    d.designs[target].styleId ? d.designs[target] : { ...d.designs.holding, styleId: null };

  const setAfter = (mode: AfterEntranceMode) =>
    update((d) => ({
      ...d,
      afterMode: mode,
      designs: mode === 'different' ? { ...d.designs, after: startDesign(d, 'after') } : d.designs,
    }));

  const setDancing = (mode: DancingMode) =>
    update((d) => ({
      ...d,
      dancingMode: mode,
      designs: mode === 'different' ? { ...d.designs, dancing: startDesign(d, 'dancing') } : d.designs,
    }));

  return (
    <Section
      title={
        <>
          Floor <Accent>design</Accent>
        </>
      }
      intro="Plan what's on the floor for each part of the night. The preview below follows the tab you're on."
    >
      <div className="subtabs" role="tablist" aria-label="Part of the night">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={phase === p.id}
            aria-controls="floor-design-panel"
            className={phase === p.id ? 'subtab active' : 'subtab'}
            onClick={() => onPhaseChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div id="floor-design-panel" role="tabpanel" aria-labelledby={`tab-${phase}`}>
        {phase === 'holding' && (
          <>
            <p className="muted">
              This is on the floor while guests arrive, before the bridal entrance. Pick a style and Stomp will make
              it with your names and photo.
            </p>
            <div className="two-col">
              <div className="builder">
                <StylePicker design={design} update={update} phase="holding" eventDate={eventDate} />
              </div>
              <div className="side-col">
                <NamesField design={design} update={update} phase="holding" />
                <InviteUpload design={design} update={update} eventDate={eventDate} />
                <CouplePhoto design={design} update={update} phase="holding" />
              </div>
            </div>
            <ReactionsPicker design={design} update={update} />
          </>
        )}

        {phase === 'after' && (
          <>
            <p className="muted">
              Once you've made your entrance, what should the floor show until the dancing starts?
            </p>
            <OptionList
              name="after-entrance"
              label="After the bridal entrance"
              options={AFTER_OPTIONS}
              value={design.afterMode}
              onChange={setAfter}
            />
            {design.afterMode === 'different' && (
              <div className="post-design">
                <h3>Your design after the entrance</h3>
                <HoldingFields design={design} update={update} phase="after" eventDate={eventDate} />
              </div>
            )}
          </>
        )}

        {phase === 'dancing' && (
          <>
            <p className="muted">When the dancing starts, what should the floor show?</p>
            <OptionList
              name="dancing-time"
              label="Dancing time"
              options={DANCING_OPTIONS}
              value={design.dancingMode}
              onChange={setDancing}
            />
            {design.dancingMode === 'videos' && <DancingVideosStrip />}
            {design.dancingMode === 'different' && (
              <div className="post-design">
                <h3>Your design for dancing time</h3>
                <HoldingFields design={design} update={update} phase="dancing" eventDate={eventDate} />
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
