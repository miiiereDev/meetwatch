import { describe, it, expect } from 'vitest';
import { buildSimulationScript } from '../src/providers/simulatorScript.js';
import { mulberry32 } from '../src/providers/rng.js';

const START = Date.parse('2026-05-04T09:00:00.000Z');
const END = START + 45 * 60_000;
const THRESHOLD_MINUTES = 10;

function scriptFor(seed: number, rosterSize = 25) {
  return buildSimulationScript({
    rosterSize,
    startsAtMs: START,
    endsAtMs: END,
    lateThresholdMinutes: THRESHOLD_MINUTES,
    seed,
  });
}

describe('buildSimulationScript', () => {
  it('produces one interval list per student', () => {
    expect(scriptFor(42)).toHaveLength(25);
  });

  it('is deterministic for a given seed', () => {
    expect(scriptFor(42)).toEqual(scriptFor(42));
  });

  it('differs across seeds', () => {
    expect(scriptFor(42)).not.toEqual(scriptFor(43));
  });

  it('keeps every interval inside the session window', () => {
    for (const intervals of scriptFor(7)) {
      for (const interval of intervals) {
        expect(interval.joinedAtMs).toBeGreaterThanOrEqual(START - 2 * 60_000);
        expect(interval.joinedAtMs).toBeLessThanOrEqual(END - 60_000);
        if (interval.leftAtMs !== null) {
          expect(interval.leftAtMs).toBeGreaterThan(interval.joinedAtMs);
          expect(interval.leftAtMs).toBeLessThanOrEqual(END - 60_000);
        }
      }
    }
  });

  it('includes students who never join, late joiners, and flaky rejoins', () => {
    // No single seed guarantees every profile appears, so assert over a union.
    const scripts = [42, 123, 999].map((seed) => scriptFor(seed));
    const all = scripts.flat();

    const never = all.filter((s) => s.length === 0);
    expect(never.length).toBeGreaterThan(0);

    const late = all.filter(
      (s) => s.length > 0 && s[0]!.joinedAtMs > START + THRESHOLD_MINUTES * 60_000,
    );
    expect(late.length).toBeGreaterThan(0);

    const flaky = all.filter((s) => s.length >= 4);
    expect(flaky.length).toBeGreaterThan(0);

    const stable = all.filter((s) => s.length === 1);
    expect(stable.length).toBeGreaterThan(0);
  });

  it('sorts intervals per student chronologically', () => {
    for (const intervals of scriptFor(999)) {
      const joined = intervals.map((i) => i.joinedAtMs);
      expect([...joined].sort((a, b) => a - b)).toEqual(joined);
    }
  });

  it('respects the seeded rng contract (mulberry32 uniform-ish)', () => {
    const rng = mulberry32(1);
    const values = [rng(), rng(), rng()];
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).toBe(values[0]);
  });
});
