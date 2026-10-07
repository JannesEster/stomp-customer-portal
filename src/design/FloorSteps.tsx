import type { UpdateDesign } from '../hooks/useDesignState';
import { formatEventDate } from '../lib/format';
import type { AfterEntranceMode, Booking, DancingMode, DesignState } from '../types';
import { OptionList, type OptionDef } from './common';
import { CouplePhoto, HoldingFields, NamesField, StylePicker } from './HoldingFields';
import { InviteUpload } from './InviteUpload';
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
        <dd>{formatEventDate(booking.eventDate)}</dd>
        <dt>Venue</dt>
        <dd>{booking.venue}</dd>
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
  );
}

export function DancingStep({ design, update, eventDate }: StepProps) {
  const setDancing = (mode: DancingMode) =>
    update((d) => ({
      ...d,
      dancingMode: mode,
      designs: mode === 'different' ? { ...d.designs, dancing: startDesign(d, 'dancing') } : d.designs,
    }));

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
        <div className="post-design">
          <h3>Your design for dancing time</h3>
          <HoldingFields design={design} update={update} phase="dancing" eventDate={eventDate} />
        </div>
      )}
    </>
  );
}
