import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDesign } from '../lib/design';
import { createCoalescedSaver, designSaveLabel, pickHydratedDesign } from './designSync';

const booking = { coupleNames: 'Sam & Alex' };

function at(iso: string) {
  const design = createDefaultDesign(booking, new Date(iso));
  design.updatedAt = iso;
  return design;
}

describe('pickHydratedDesign', () => {
  it('lets the server win unless the local copy is strictly newer', () => {
    const local = at('2026-01-01T00:00:00.000Z');
    local.dancingNote = 'local note';
    const remote = at('2026-03-01T00:00:00.000Z');
    remote.dancingNote = 'remote note';

    const serverWins = pickHydratedDesign(local, remote, '2026-03-02T00:00:00.000Z', booking);
    expect(serverWins.source).toBe('remote');
    expect(serverWins.pushLocal).toBe(false);
    expect(serverWins.design.dancingNote).toBe('remote note');

    const sameTime = at('2026-03-02T00:00:00.000Z');
    sameTime.dancingNote = 'local same';
    const tied = pickHydratedDesign(sameTime, remote, '2026-03-02T00:00:00.000Z', booking);
    expect(tied.source).toBe('remote');
    expect(tied.design.dancingNote).toBe('remote note');

    const newerLocal = at('2026-08-01T00:00:00.000Z');
    newerLocal.dancingMode = 'videos';
    const localWins = pickHydratedDesign(newerLocal, remote, '2026-03-02T00:00:00.000Z', booking);
    expect(localWins.source).toBe('local');
    expect(localWins.pushLocal).toBe(true);
    expect(localWins.design.dancingMode).toBe('videos');
  });

  it('keeps a local draft when the server copy is blank or unusable, and does not push a fresh default', () => {
    const local = at('2026-05-01T00:00:00.000Z');
    local.stylingNote = 'kept';
    expect(pickHydratedDesign(local, null, null, booking)).toMatchObject({ source: 'local', pushLocal: true });
    expect(pickHydratedDesign(local, { version: 1, stylingNote: 'old' }, '2099-01-01T00:00:00.000Z', booking).design.stylingNote).toBe(
      'kept',
    );
    expect(pickHydratedDesign(null, 'not json', null, booking)).toMatchObject({ source: 'default', pushLocal: false });
  });
});

describe('createCoalescedSaver', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces to a single save', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const saver = createCoalescedSaver({
      delayMs: 2000,
      save: async () => {
        calls.push('save');
        return true;
      },
    });
    saver.schedule();
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual(['save']);
    saver.dispose();
  });

  it('runs a queued save after the one in flight finishes', async () => {
    vi.useFakeTimers();
    let resolveSave: (ok: boolean) => void = () => {};
    const calls: number[] = [];
    const saver = createCoalescedSaver({
      delayMs: 2000,
      save: () => {
        calls.push(calls.length + 1);
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      },
    });
    saver.flush();
    expect(calls).toEqual([1]);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toEqual([1]);
    resolveSave(true);
    await vi.waitFor(() => expect(calls).toEqual([1, 2]));
    saver.dispose();
  });

  it('retries a failed save with backoff', async () => {
    vi.useFakeTimers();
    let n = 0;
    const saver = createCoalescedSaver({
      delayMs: 2000,
      save: async () => {
        n += 1;
        return n > 1;
      },
    });
    saver.schedule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(n).toBe(2);
    saver.dispose();
  });
});

describe('designSaveLabel', () => {
  it('shows saving, the saved time, or the offline line without a dash', () => {
    const saving = designSaveLabel({
      submitted: false,
      submittedWithoutTimes: false,
      saveStatus: 'saving',
      savedAt: null,
      serverSync: true,
    });
    const saved = designSaveLabel({
      submitted: false,
      submittedWithoutTimes: false,
      saveStatus: 'saved',
      savedAt: '2026-10-08T01:26:00.000Z',
      serverSync: true,
    });
    const offline = designSaveLabel({
      submitted: true,
      submittedWithoutTimes: false,
      saveStatus: 'error',
      savedAt: null,
      serverSync: true,
    });
    expect(saving).toBe('Draft, Saving…');
    expect(saved.startsWith('Draft, Saved ')).toBe(true);
    expect(offline).toBe('Submitted, Offline, saved on this device');
    for (const label of [saving, saved, offline]) {
      expect(label).not.toMatch(/[—–]| - /);
    }
  });
});
