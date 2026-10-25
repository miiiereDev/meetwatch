import { mulberry32 } from './rng.js';

/**
 * Pure generator for simulated student behavior. Deterministic for a given
 * seed so demos and tests are reproducible.
 *
 * Behavior profiles (per student):
 *  - never    (~8%)  never joins
 *  - flaky    (~20%) joins, drops, and rejoins 3-4 times
 *  - late     (~15%) joins after the late threshold
 *  - punctual (rest) joins near the start, most stay until the end
 */

const MINUTE = 60_000;

export interface ScriptedInterval {
  /** Sim-time ms since epoch for the join. */
  joinedAtMs: number;
  /** Sim-time ms for the leave, or null to stay until the session closes. */
  leftAtMs: number | null;
}

export interface SimulationScriptInput {
  rosterSize: number;
  startsAtMs: number;
  endsAtMs: number;
  lateThresholdMinutes: number;
  seed: number;
}

export function buildSimulationScript(input: SimulationScriptInput): ScriptedInterval[][] {
  const { rosterSize, startsAtMs, endsAtMs, lateThresholdMinutes, seed } = input;
  const rng = mulberry32(seed);
  const thresholdMs = startsAtMs + lateThresholdMinutes * MINUTE;
  const script: ScriptedInterval[][] = [];

  for (let i = 0; i < rosterSize; i++) {
    const roll = rng();
    if (roll < 0.08) {
      script.push([]); // never shows up
      continue;
    }
    if (roll < 0.28) {
      script.push(sanitize(flaky(rng, startsAtMs, endsAtMs), startsAtMs, endsAtMs));
      continue;
    }
    if (roll < 0.43) {
      script.push(sanitize(late(rng, thresholdMs, endsAtMs), startsAtMs, endsAtMs));
      continue;
    }
    script.push(sanitize(punctual(rng, startsAtMs, endsAtMs), startsAtMs, endsAtMs));
  }
  return script;
}

/** Guarantees the script invariants regardless of random draws. */
function sanitize(
  intervals: ScriptedInterval[],
  startsAtMs: number,
  endsAtMs: number,
): ScriptedInterval[] {
  const earliest = startsAtMs - 2 * MINUTE;
  const latest = endsAtMs - MINUTE;
  return intervals
    .map((interval) => ({
      joinedAtMs: Math.min(Math.max(interval.joinedAtMs, earliest), latest),
      leftAtMs:
        interval.leftAtMs === null ? null : Math.min(Math.max(interval.leftAtMs, earliest), latest),
    }))
    .filter((interval) => interval.leftAtMs === null || interval.leftAtMs > interval.joinedAtMs)
    .sort((a, b) => a.joinedAtMs - b.joinedAtMs);
}

function leaveBeforeEnd(rng: () => number, earliest: number, endsAtMs: number): number | null {
  const latest = endsAtMs - MINUTE;
  const candidate = Math.min(endsAtMs - rng() * 20 * MINUTE, latest);
  if (candidate <= earliest + MINUTE) return null; // stay until the session closes
  return Math.max(earliest + MINUTE, candidate);
}

function punctual(rng: () => number, startsAtMs: number, endsAtMs: number): ScriptedInterval[] {
  const joinedAt = clampJoin(startsAtMs + (-2 + rng() * 10) * MINUTE, startsAtMs, endsAtMs);
  const intervals: ScriptedInterval[] = [{ joinedAtMs: joinedAt, leftAtMs: null }];

  // 12% have a single mid-session drop and rejoin.
  if (rng() < 0.12) {
    const dropAt = joinedAt + (10 + rng() * 15) * MINUTE;
    if (dropAt < endsAtMs - 6 * MINUTE) {
      intervals[0] = { joinedAtMs: joinedAt, leftAtMs: dropAt };
      const rejoin = Math.min(dropAt + (2 + rng() * 4) * MINUTE, endsAtMs - MINUTE);
      if (rejoin > dropAt) intervals.push({ joinedAtMs: rejoin, leftAtMs: null });
    }
    return intervals;
  }

  intervals[0] = {
    joinedAtMs: joinedAt,
    leftAtMs: leaveBeforeEnd(rng, joinedAt + 5 * MINUTE, endsAtMs),
  };
  return intervals;
}

function late(rng: () => number, thresholdMs: number, endsAtMs: number): ScriptedInterval[] {
  const joinedAt = clampJoin(thresholdMs + (1 + rng() * 15) * MINUTE, thresholdMs, endsAtMs);
  return [{ joinedAtMs: joinedAt, leftAtMs: leaveBeforeEnd(rng, joinedAt + 5 * MINUTE, endsAtMs) }];
}

function flaky(rng: () => number, startsAtMs: number, endsAtMs: number): ScriptedInterval[] {
  const intervals: ScriptedInterval[] = [];
  const latest = endsAtMs - MINUTE;
  let joinedAt = clampJoin(startsAtMs + rng() * 5 * MINUTE, startsAtMs, endsAtMs);
  const stints = 3 + Math.floor(rng() * 2); // 3-4 intervals => 2-3 rejoins

  for (let s = 0; s < stints; s++) {
    const minLeave = joinedAt + MINUTE;
    if (minLeave >= latest) {
      intervals.push({ joinedAtMs: joinedAt, leftAtMs: null });
      break;
    }
    const isLast = s === stints - 1;
    const rawLeave = joinedAt + (3 + rng() * 5) * MINUTE;
    const leftAt = isLast && rng() < 0.7 ? null : Math.min(rawLeave, latest);
    intervals.push({
      joinedAtMs: joinedAt,
      leftAtMs: leftAt === null ? null : Math.max(leftAt, minLeave),
    });
    const nextJoin = (leftAt ?? minLeave) + (1 + rng() * 3) * MINUTE;
    if (nextJoin > latest) break;
    joinedAt = nextJoin;
  }
  return intervals;
}

function clampJoin(ms: number, startsAtMs: number, endsAtMs: number): number {
  return Math.min(Math.max(ms, startsAtMs - 2 * MINUTE), endsAtMs - MINUTE);
}
