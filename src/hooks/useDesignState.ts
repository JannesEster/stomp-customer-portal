import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../services';
import type { Booking, DesignState } from '../types';
import type { StepId } from '../design/steps';
import { confirmStep, withConfirmed } from '../lib/design';
import { createCoalescedSaver, pickHydratedDesign, type SaveStatus } from './designSync';
import {
  beaconPortalAnswers,
  captureFloorPngs,
  floorPreviewHash,
  postFloorPreviews,
  postPortalAnswers,
  shouldUploadFloorPreview,
} from './floorPreviewSync';

export type { SaveStatus };

const LOCAL_SAVE_MS = 400;
const SERVER_SAVE_MS = 2_000;
const PREVIEW_SAVE_MS = 5_000;
const openedTokens = new Set<string>();

export function useDesignState(booking: Booking) {
  const { storage, portal } = useServices();
  const token = portal?.token ?? null;
  const serverSync = token !== null;
  const key = `design:${booking.id}`;
  const [design, setDesign] = useState<DesignState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef<DesignState | null>(null);
  const flushNow = useRef(false);
  const previewNow = useRef(false);
  const previewHash = useRef<string | null>(null);
  const previewTimer = useRef<number | null>(null);
  const previewFlight = useRef(false);
  const previewQueued = useRef(false);
  const saver = useRef<ReturnType<typeof createCoalescedSaver> | null>(null);
  latest.current = design;

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    setDesign(null);
    void (async () => {
      const local = await storage.loadData<DesignState>(key);
      const remote = portal ? await portal.load() : null;
      if (cancelled) return;
      const picked = pickHydratedDesign(local, remote?.savedAnswers ?? null, remote?.lastSavedAt ?? null, booking);
      previewHash.current = picked.pushLocal ? null : floorPreviewHash(picked.design);
      if (picked.source === 'remote') void storage.saveData(key, picked.design);
      if (picked.pushLocal) dirty.current = true;
      if (picked.source === 'remote' && remote?.lastSavedAt) {
        setSavedAt(remote.lastSavedAt);
        setSaveStatus('saved');
      }
      setDesign(picked.design);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, booking, storage, portal]);

  useEffect(() => {
    if (!token) {
      saver.current = null;
      return;
    }
    const next = createCoalescedSaver({
      delayMs: SERVER_SAVE_MS,
      save: async () => {
        const current = latest.current;
        if (!current) return true;
        try {
          const result = await postPortalAnswers(token, current);
          await storage.saveData(key, current);
          if (latest.current === current) {
            dirty.current = false;
            setSavedAt(result.lastSavedAt);
            setSaveStatus('saved');
          }
          return true;
        } catch {
          setSaveStatus('error');
          return false;
        }
      },
    });
    saver.current = next;
    return () => {
      next.dispose();
      if (saver.current === next) saver.current = null;
    };
  }, [token, key, storage]);

  useEffect(() => {
    if (!token || openedTokens.has(token)) return;
    openedTokens.add(token);
    void fetch(`/api/portal/${encodeURIComponent(token)}/opened`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
  }, [token]);

  useEffect(() => {
    if (!design || !dirty.current) return;
    setSaveStatus('saving');
    const snapshot = design;
    if (token) {
      const localTimer = window.setTimeout(() => {
        void storage.saveData(key, snapshot);
      }, LOCAL_SAVE_MS);
      if (flushNow.current) {
        flushNow.current = false;
        saver.current?.flush();
      } else {
        saver.current?.schedule();
      }
      return () => window.clearTimeout(localTimer);
    }

    const localTimer = window.setTimeout(() => {
      storage
        .saveData(key, snapshot)
        .then(() => {
          dirty.current = false;
          setSaveStatus('saved');
        })
        .catch(() => setSaveStatus('error'));
    }, LOCAL_SAVE_MS);
    return () => window.clearTimeout(localTimer);
  }, [design, key, storage, token]);

  useEffect(() => {
    if (!token) return;
    const send = () => {
      const current = latest.current;
      if (!current || !dirty.current) return;
      void storage.saveData(key, current);
      beaconPortalAnswers(token, current);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') send();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', send);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', send);
      send();
    };
  }, [token, key, storage]);

  useEffect(() => {
    if (!token || !design) return;
    const reason = previewNow.current ? 'submit' : 'change';
    previewNow.current = false;
    const hash = floorPreviewHash(design);
    if (!shouldUploadFloorPreview(previewHash.current, hash, reason)) return;
    if (previewTimer.current != null) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = null;
      void uploadPreview(hash);
    }, reason === 'submit' ? 0 : PREVIEW_SAVE_MS);

    async function uploadPreview(expectedHash: string) {
      const current = latest.current;
      if (!current || !token) return;
      if (previewFlight.current) {
        previewQueued.current = true;
        return;
      }
      previewFlight.current = true;
      try {
        const images = await captureFloorPngs(booking, current);
        if (images?.length) await postFloorPreviews(token, images);
        if (images?.length) previewHash.current = expectedHash;
      } catch {
        /* Preview failures stay quiet. The design name is saved with the answers. */
      } finally {
        previewFlight.current = false;
        if (previewQueued.current) {
          previewQueued.current = false;
          const again = latest.current;
          if (again) void uploadPreview(floorPreviewHash(again));
        }
      }
    }
  }, [design, token, booking]);

  /** Any edit puts a submitted design back into draft until it is submitted again. */
  const update = useCallback((change: (d: DesignState) => DesignState) => {
    dirty.current = true;
    setDesign((d) => (d ? { ...change(d), status: 'draft', updatedAt: new Date().toISOString() } : d));
  }, []);

  /** Moving on confirms the step that was on screen. A submitted design stays submitted. */
  const noteStep = useCallback((stepId: StepId) => {
    setDesign((d) => {
      if (!d) return d;
      const next = confirmStep(d, stepId, new Date().toISOString());
      if (next === d) return d;
      dirty.current = true;
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    dirty.current = true;
    flushNow.current = true;
    previewNow.current = true;
    const now = new Date().toISOString();
    setDesign((d) =>
      d
        ? {
            ...withConfirmed(d, 'review'),
            status: 'submitted',
            submittedAt: now,
            updatedAt: now,
            submittedWithoutTimes: !d.entranceTime || !d.dancingStarts,
          }
        : d,
    );
  }, []);

  return { design, update, submit, noteStep, saveStatus, savedAt, serverSync };
}

export type UpdateDesign = (change: (d: DesignState) => DesignState) => void;
