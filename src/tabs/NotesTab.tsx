import { useDesignState } from '../hooks/useDesignState';
import { Accent } from '../design/common';
import type { Booking } from '../types';

export function NotesTab({ booking }: { booking: Booking }) {
  const { design, update, saveStatus, serverSync } = useDesignState(booking);

  const setTime = (field: 'entranceTime' | 'dancingStarts', value: string) =>
    update((d) => ({ ...d, [field]: value }));

  return (
    <section className="card">
      <h2>
        Times and <Accent>notes</Accent>
      </h2>
      <p className="muted">
        Tell Stomp Sphere when the bridal entrance is and when the dancing starts. These are when the floor and
        screens change. Leave a time blank if you're not sure yet.
      </p>
      <div className="time-fields">
        <label className="field">
          <span>Bridal entrance</span>
          <input
            type="time"
            value={design?.entranceTime ?? ''}
            disabled={!design}
            onChange={(e) => setTime('entranceTime', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Dancing starts</span>
          <input
            type="time"
            value={design?.dancingStarts ?? ''}
            disabled={!design}
            onChange={(e) => setTime('dancingStarts', e.target.value)}
          />
        </label>
      </div>
      <p className="muted small" aria-live="polite">
        {saveStatus === 'saved'
          ? 'Saved to your booking'
          : saveStatus === 'saving'
            ? 'Saving…'
            : saveStatus === 'error'
              ? serverSync
                ? 'Offline, saved on this device'
                : "Couldn't save. Check your connection."
              : '\u00a0'}
      </p>
      <p className="muted">
        Venue access, who to call on the day, or anything else Stomp Sphere should know about the dance floor and
        screens.
      </p>
      <textarea
        className="notes"
        rows={10}
        value={design?.notes ?? ''}
        disabled={!design}
        placeholder="Add entrance and dancing times."
        onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))}
      />
    </section>
  );
}
