import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('rate limit', () => {
  it('blocks once the window is full and allows again after it passes', () => {
    const allow = createRateLimiter({ windowMs: 1000, max: 2 });
    expect(allow('1.2.3.4', 0)).toBe(true);
    expect(allow('1.2.3.4', 10)).toBe(true);
    expect(allow('1.2.3.4', 20)).toBe(false);
    expect(allow('5.6.7.8', 20)).toBe(true);
    expect(allow('1.2.3.4', 1001)).toBe(true);
  });
});
