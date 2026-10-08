import { DESIGN_VERSION, usableDesign } from '../lib/design';
import { formatDateTime } from '../lib/format';
import type { Booking, DesignState, SupplierDetails } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface HydratedDesign {
  design: DesignState;
  /** Push this copy to the server. True when this browser is strictly newer, or the server has nothing yet. */
  pushLocal: boolean;
  source: 'remote' | 'local' | 'default';
}

/**
 * Server answers win, unless the copy in localStorage has a newer saved timestamp.
 * A blank or unusable server copy leaves the local draft in place.
 */
export function pickHydratedDesign(
  local: DesignState | null,
  remote: unknown,
  remoteSavedAt: string | null,
  booking: Pick<Booking, 'coupleNames'> & Partial<SupplierDetails>,
): HydratedDesign {
  const remoteDesign = currentDesign(remote) ? usableDesign(remote, booking) : null;
  const localDesign = currentDesign(local) ? usableDesign(local, booking) : null;
  const localAt = stamp(localDesign?.updatedAt);
  const remoteAt = stamp(remoteSavedAt) ?? stamp(remoteDesign?.updatedAt);

  if (remoteDesign && !(localDesign && localAt != null && remoteAt != null && localAt > remoteAt)) {
    return { design: remoteDesign, pushLocal: false, source: 'remote' };
  }
  if (localDesign) {
    return { design: localDesign, pushLocal: true, source: 'local' };
  }
  return { design: usableDesign(null, booking), pushLocal: false, source: 'default' };
}

function currentDesign(value: unknown): value is DesignState {
  return !!value && typeof value === 'object' && (value as DesignState).version === DESIGN_VERSION;
}

function stamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export interface CoalescedSaver {
  /** Wait `delayMs` after the last call, then save. */
  schedule: () => void;
  /** Save immediately, cancelling the debounce. */
  flush: () => void;
  dispose: () => void;
}

/**
 * One save at a time. A change that arrives mid-flight is saved once when the current save finishes.
 * Failures retry with backoff until a save succeeds or the saver is disposed.
 */
export function createCoalescedSaver(opts: {
  delayMs: number;
  save: () => Promise<boolean>;
  timers?: {
    set: (fn: () => void, ms: number) => number;
    clear: (id: number) => void;
  };
}): CoalescedSaver {
  const set = opts.timers?.set ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number);
  const clear = opts.timers?.clear ?? ((id) => clearTimeout(id));
  let timer: number | null = null;
  let inFlight = false;
  let queued = false;
  let stopped = false;
  let retryMs = opts.delayMs;

  const clearTimer = () => {
    if (timer != null) clear(timer);
    timer = null;
  };

  const run = () => {
    if (stopped) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    void opts
      .save()
      .then((ok) => {
        if (ok) retryMs = opts.delayMs;
        else scheduleRetry();
      })
      .catch(() => scheduleRetry())
      .finally(() => {
        inFlight = false;
        if (stopped) return;
        if (queued) {
          queued = false;
          run();
        }
      });
  };

  const scheduleRetry = () => {
    if (stopped) return;
    clearTimer();
    const wait = retryMs;
    retryMs = Math.min(retryMs * 2, 30_000);
    timer = set(() => {
      timer = null;
      run();
    }, wait);
  };

  return {
    schedule() {
      if (stopped) return;
      clearTimer();
      timer = set(() => {
        timer = null;
        run();
      }, opts.delayMs);
    },
    flush() {
      if (stopped) return;
      clearTimer();
      run();
    },
    dispose() {
      stopped = true;
      queued = false;
      clearTimer();
    },
  };
}

/** Footer text next to Draft or Submitted. New copy uses full stops and commas, never a dash. */
export function designSaveLabel(opts: {
  submitted: boolean;
  submittedWithoutTimes: boolean;
  saveStatus: SaveStatus;
  savedAt: string | null;
  serverSync: boolean;
}): string {
  if (!opts.serverSync) {
    if (opts.submitted) return opts.submittedWithoutTimes ? 'Submitted without times' : 'Submitted';
    if (opts.saveStatus === 'saving') return 'Saving…';
    if (opts.saveStatus === 'saved') return 'Draft saved';
    if (opts.saveStatus === 'error') return "Couldn't save. Check your connection.";
    return 'Draft';
  }
  const base = opts.submitted
    ? opts.submittedWithoutTimes
      ? 'Submitted without times'
      : 'Submitted'
    : 'Draft';
  const extra = saveExtra(opts.saveStatus, opts.savedAt, true);
  return extra ? `${base}, ${extra}` : base;
}

function saveExtra(status: SaveStatus, savedAt: string | null, serverSync: boolean): string | null {
  if (status === 'saving') return 'Saving…';
  if (status === 'error') return serverSync ? 'Offline, saved on this device' : "Couldn't save. Check your connection.";
  if (status === 'saved') {
    if (savedAt && Number.isFinite(Date.parse(savedAt))) return `Saved ${formatDateTime(savedAt)}`;
    return 'Saved';
  }
  return null;
}
