import type { UpdateDesign } from '../hooks/useDesignState';
import { formatEventDate } from '../lib/format';
import {
  generatedFor,
  INVITE_AFTER_STYLE_ID,
  inviteInputs,
  LAYOUT_LABELS,
  otherInviteStyles,
  TYPOGRAPHY_LABELS,
} from '../lib/inviteStyle';
import type { AfterEntranceMode, Booking, DancingMode, DesignState, GeneratedStyle } from '../types';
import { OptionList, type OptionDef } from './common';
import { CouplePhoto, HoldingFields, NamesField, StylePicker } from './HoldingFields';
import { InviteUpload } from './InviteUpload';
import { DancingVideosStrip } from './DancingVideosStrip';
import { GeneratedThumb } from './GeneratedThumb';

function afterOptions(hasBeforeReactions: boolean): OptionDef<AfterEntranceMode>[] {
  return [
    {
      id: 'same',
      label: 'Keep the holding screen',
      hint: hasBeforeReactions
        ? 'Your holding screen and its reactions stay on until dancing time.'
        : 'Your holding screen stays on until dancing time. You can add reactions for after the entrance on the next step.',
      recommended: true,
    },
    { id: 'different', label: 'Use a different style', hint: 'Pick a second design to show until dancing time.' },
  ];
}

const DANCING_OPTIONS: OptionDef<DancingMode>[] = [
  {
    id: 'blank',
    label: 'Blank floor with assorted reactions',
    hint: 'The floor goes dark and keeps changing through a mix of reactions as people dance.',
    recommended: true,
  },
  {
    id: 'videos',
    label: 'Assorted colourful videos',
    hint: 'Bright moving visuals, like neon tunnels, golden swirls and kaleidoscopes, change from one to the next across the floor.',
  },
  {
    id: 'different',
    label: 'Use a different design',
    hint: 'Tell Stomp what you have in mind for the floor while people dance.',
  },
];

interface StepProps {
  design: DesignState;
  update: UpdateDesign;
  eventDate: string;
}

/** A second design starts with the holding screen's names and photo, but the couple picks a new style. */
function startDesign(d: DesignState, target: 'after' | 'dancing') {
  return d.designs[target].styleId ? d.designs[target] : { ...d.designs.holding, styleId: null };
}

export function DetailsStep({
  booking,
  design,
  update,
}: {
  booking: Booking;
  design: DesignState;
  update: UpdateDesign;
}) {
  return (
    <div className="details-step">
      <NamesField design={design} update={update} phase="holding" />
      <dl className="details">
        <dt>Wedding date</dt>
        <dd>{formatEventDate(booking.eventDate) || 'Not listed yet'}</dd>
        <dt>Venue</dt>
        <dd>{booking.venue || 'Not listed yet'}</dd>
      </dl>
      <p className="muted small">
        We've filled these in from your booking. If the date or venue isn't right, let Stomp know.
      </p>
    </div>
  );
}

export function HoldingScreenStep({ design, update, eventDate }: StepProps) {
  return (
    <div className="two-col">
      <div className="builder">
        <StylePicker design={design} update={update} phase="holding" eventDate={eventDate} />
      </div>
      <div className="side-col">
        <InviteUpload design={design} update={update} eventDate={eventDate} />
        <CouplePhoto design={design} update={update} phase="holding" />
      </div>
    </div>
  );
}

export function AfterEntranceStep({ design, update, eventDate }: StepProps) {
  const setAfter = (mode: AfterEntranceMode) =>
    update((d) => ({
      ...d,
      afterMode: mode,
      designs: mode === 'different' ? { ...d.designs, after: startDesign(d, 'after') } : d.designs,
    }));

  return (
    <>
      <OptionList
        name="after-entrance"
        label="After the bridal entrance"
        options={afterOptions(design.reactions.length > 0)}
        value={design.afterMode}
        onChange={setAfter}
      />
      {design.afterMode === 'different' && (
        <div className={design.inviteStyle ? 'two-col post-design' : 'post-design'}>
          <div>
            <h3>Your design after the entrance</h3>
            <HoldingFields design={design} update={update} phase="after" eventDate={eventDate} />
          </div>
          {design.inviteStyle && <InviteVersions design={design} update={update} eventDate={eventDate} />}
        </div>
      )}
    </>
  );
}

/** The other versions made from the invite, so after the entrance can use a different one. */
function InviteVersions({ design, update, eventDate }: StepProps) {
  const current = design.inviteStyle;
  if (!current) return null;
  const shown = otherInviteStyles(current, inviteInputs(design)).slice(0, 10);
  const chosen = generatedFor(design, design.designs.after.styleId);

  const pick = (style: GeneratedStyle) =>
    update((d) => ({
      ...d,
      afterInviteStyle: style,
      designs: { ...d.designs, after: { ...d.designs.after, styleId: INVITE_AFTER_STYLE_ID } },
    }));

  return (
    <aside className="invite invite-versions">
      <h3>Other designs from your invite</h3>
      <p className="muted small">
        These are the other versions made from your invite and styling note. Pick one for after the entrance.
      </p>
      <div className="style-grid" role="radiogroup" aria-label="Other designs from your invite">
        {shown.map((style) => {
          const active = chosen?.variant === style.variant && chosen.basedOn === style.basedOn;
          return (
            <button
              key={style.variant}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'style-card active' : 'style-card'}
              onClick={() => pick(style)}
            >
              <span className="style-thumb">
                <GeneratedThumb style={style} names={design.designs.after.names} eventDate={eventDate} />
              </span>
              <span className="style-name">
                {TYPOGRAPHY_LABELS[style.typography]}, {LAYOUT_LABELS[style.layout]}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function DancingStep({ design, update }: StepProps) {
  const setDancing = (mode: DancingMode) => update((d) => ({ ...d, dancingMode: mode }));

  return (
    <>
      <OptionList
        name="dancing-time"
        label="Dancing time"
        options={DANCING_OPTIONS}
        value={design.dancingMode}
        onChange={setDancing}
      />
      {design.dancingMode === 'videos' && <DancingVideosStrip />}
      {design.dancingMode === 'different' && (
        <label className="field">
          <span>What do you have in mind?</span>
          <textarea
            rows={4}
            value={design.dancingNote ?? ''}
            placeholder="Describe the look you want while people dance"
            onChange={(e) => update((d) => ({ ...d, dancingNote: e.target.value }))}
          />
        </label>
      )}
    </>
  );
}
