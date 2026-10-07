/** Fixed window counter. Enough for a single free Render instance. */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  return function allow(key: string, now = Date.now()): boolean {
    const start = now - opts.windowMs;
    const recent = (hits.get(key) ?? []).filter((time) => time > start);
    if (recent.length >= opts.max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [id, times] of hits) {
        const kept = times.filter((time) => time > start);
        if (kept.length === 0) hits.delete(id);
        else hits.set(id, kept);
      }
    }
    return true;
  };
}
