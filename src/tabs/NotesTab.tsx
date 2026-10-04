import { useEffect, useRef, useState } from 'react';
import { useServices } from '../services';
import { Accent } from '../design/common';
import type { Booking } from '../types';

export function NotesTab({ booking }: { booking: Booking }) {
  const { storage } = useServices();
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

  return (
    <section className="card">
      <h2>
        Notes and <Accent>details</Accent>
      </h2>
      <p className="muted">
        Anything else Stomp should know about your night? Timings, song requests, venue access, who to call on the day.
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
