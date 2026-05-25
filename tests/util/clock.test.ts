import { describe, expect, it } from 'vitest';
import { addDays, isExpired, now } from '../../src/util/clock.js';

describe('now', () => {
  it('returns the current epoch millis', () => {
    const before = Date.now();
    const value = now();
    const after = Date.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });
});

describe('addDays', () => {
  it('adds whole days as milliseconds', () => {
    const base = 1_700_000_000_000;
    expect(addDays(base, 1)).toBe(base + 86_400_000);
    expect(addDays(base, 7)).toBe(base + 7 * 86_400_000);
  });

  it('accepts zero and negative offsets', () => {
    const base = 1_700_000_000_000;
    expect(addDays(base, 0)).toBe(base);
    expect(addDays(base, -2)).toBe(base - 2 * 86_400_000);
  });

  it('rejects non-finite or non-integer day counts', () => {
    expect(() => addDays(0, 1.5)).toThrow(/integer/);
    expect(() => addDays(0, Number.NaN)).toThrow(/integer/);
    expect(() => addDays(0, Number.POSITIVE_INFINITY)).toThrow(/integer/);
  });
});

describe('isExpired', () => {
  it('returns true when the deadline is in the past', () => {
    expect(isExpired(100, 200)).toBe(true);
  });

  it('returns false when the deadline is in the future', () => {
    expect(isExpired(300, 200)).toBe(false);
  });

  it('treats deadline equal to now as expired (inclusive boundary)', () => {
    expect(isExpired(200, 200)).toBe(true);
  });
});
