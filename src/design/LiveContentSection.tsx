import { extrasConfig } from '../config';
import { liveContentView } from '../lib/liveContent';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { Booking, DesignState } from '../types';
import { Accent, Section } from './common';

export function LiveContentSection({
  booking,
  design,
  update,
}: {
  booking: Booking;
  design: DesignState;
  update: UpdateDesign;
}) {
  const view = liveContentView(booking, design.liveContentRequested);
  const extra = extrasConfig.extras.find((e) => e.id === extrasConfig.liveContentExtraId);

  return (
    <Section
      title={
        <>
          Add live <Accent>content</Accent>
        </>
      }
    >
      <label className={view.locked ? 'check big locked' : 'check big'}>
        <input
          type="checkbox"
          checked={view.checked}
          disabled={view.locked}
          onChange={(e) => update((d) => ({ ...d, liveContentRequested: e.target.checked }))}
        />{' '}
        {view.label}
      </label>
      <p className="muted">{extra?.description}</p>
      {!view.included && view.checked && (
        <p className="note">
          Thanks, we've noted your request. Stomp will be in touch to confirm. Nothing is charged through the portal.
        </p>
      )}
    </Section>
  );
}
