import { useEffect, useRef, useState } from 'react';
import { useServices } from '../services';
import { useDesignState } from '../hooks/useDesignState';
import { Accent } from '../design/common';
import type { Booking } from '../types';

export function NotesTab({ booking }: { booking: Booking }) {
  const { storage } = useServices();
  const { design, update, saveStatus, serverSync } = useDesignState(booking);
  const key = `notes:${booking.id}`;
  const [notes, setNotes] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    storage.loadData<string>(key).then((n) => setNotes(n ?? ''));
  }, [key, storage]);

  useEffect(() => {
    if (notes === null || !dirty.current) return;
    setSaved(false);
    const t = window.setTimeout(() => storage.saveData(key, notes).then(() => setSaved(true)), 400);
    return () => window.clearTimeout(t);
  }, [notes, key, storage]);

  const setTime = (field: 'entranceTime' | 'dancingStarts', value: string) =>
    update((d) => ({ ...d, [field]: value }));

  return (
    <section className="card">
      <h2>
        Notes and <Accent>details</Accent>
      </h2>
      <p className="muted">
        Tell Stomp when the bridal entrance is and when the dancing starts. These are when the floor and screens
        change. Leave a time blank if you're not sure yet.
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
      {design && !design.entranceTime && !design.dancingStarts && (
        <button type="button" className="time-skip" onClick={() => { window.location.hash = 'design'; }}>
          Not finalised but let's get the design sorted
        </button>
      )}
      <p className="muted small" aria-live="polite">
        {saveStatus === 'saved'
          ? 'Times saved'
          : saveStatus === 'saving'
            ? 'Saving times…'
            : saveStatus === 'error'
              ? serverSync
                ? 'Offline, saved on this device'
                : "Couldn't save. Check your connection."
              : '\u00a0'}
      </p>
      <p className="muted">
        Venue access, who to call on the day, or anything else Stomp should know about the dance floor and screens.
      </p>
      <textarea
        className="notes"
        rows={10}
        value={notes ?? ''}
        disabled={notes === null}
        placeholder="Type your notes here"
        onChange={(e) => {
          dirty.current = true;
          setNotes(e.target.value);
        }}
      />
      <p className="muted small" aria-live="polite">
        {saved ? 'Saved' : '\u00a0'}
      </p>
    </section>
  );
}
