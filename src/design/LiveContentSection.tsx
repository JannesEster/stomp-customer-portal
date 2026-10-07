import { extrasConfig } from '../config';
import { liveContentView } from '../lib/liveContent';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { Booking, DesignState } from '../types';

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
    <div className="live-content">
      <h3>Add live content</h3>
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
      <p className="muted small">
        Whether adding live content changes your booking price is pending Jannes's decision. Nothing is charged in the
        portal.
      </p>
      {!view.included && view.checked && (
        <p className="note">
          Thanks, we've noted your request. Stomp will be in touch to confirm. Nothing is charged through the portal.
        </p>
      )}
    </div>
  );
}
