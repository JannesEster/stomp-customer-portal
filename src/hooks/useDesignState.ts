import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../services';
import { usableDesign } from '../lib/design';
import type { Booking, DesignState } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 400;

export function useDesignState(booking: Booking) {
  const { storage } = useServices();
  const key = `design:${booking.id}`;
  const [design, setDesign] = useState<DesignState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const dirty = useRef(false);
  const latest = useRef<DesignState | null>(null);
  latest.current = design;

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    setDesign(null);
    storage.loadData<DesignState>(key).then((saved) => {
      if (!cancelled) setDesign(usableDesign(saved, booking));
    });
    return () => {
      cancelled = true;
    };
  }, [key, booking, storage]);

  useEffect(() => {
    if (!design || !dirty.current) return;
    setSaveStatus('saving');
    const t = window.setTimeout(() => {
      storage
        .saveData(key, design)
        .then(() => {
          dirty.current = false;
          setSaveStatus('saved');
        })
        .catch(() => setSaveStatus('error'));
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [design, key, storage]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current && latest.current) void storage.saveData(key, latest.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [key, storage]);

  /** Any edit puts a submitted design back into draft until it is submitted again. */
  const update = useCallback((change: (d: DesignState) => DesignState) => {
    dirty.current = true;
    setDesign((d) => (d ? { ...change(d), status: 'draft', updatedAt: new Date().toISOString() } : d));
  }, []);

  const submit = useCallback(() => {
    dirty.current = true;
    const now = new Date().toISOString();
    setDesign((d) =>
      d
        ? {
            ...d,
            status: 'submitted',
            submittedAt: now,
            updatedAt: now,
            submittedWithoutTimes: !d.entranceTime || !d.dancingStarts,
          }
        : d,
    );
  }, []);

  return { design, update, submit, saveStatus };
}

export type UpdateDesign = (change: (d: DesignState) => DesignState) => void;
