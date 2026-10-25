import { describe, expect, it } from 'vitest';
import { parseParticipation, parseTimestamp } from '../src/providers/csvImport.js';

describe('parseTimestamp', () => {
  it('parses ISO-8601 with zone', () => {
    expect(parseTimestamp('2026-05-04T09:00:00Z', 2)).toBe('2026-05-04T09:00:00.000Z');
    expect(parseTimestamp('2026-05-04T09:00:00+02:00', 2)).toBe('2026-05-04T07:00:00.000Z');
  });

  it('treats naive date-times as UTC', () => {
    expect(parseTimestamp('2026-05-04 09:30:00', 2)).toBe('2026-05-04T09:30:00.000Z');
    expect(parseTimestamp('2026-05-04 09:30', 2)).toBe('2026-05-04T09:30:00.000Z');
  });

  it('parses the US export style with AM/PM', () => {
    // Local time: the exact UTC instant depends on the machine timezone, so
    // assert on the UTC-projected wall clock instead.
    const parsed = parseTimestamp('5/4/26, 12:05:30 PM', 2);
    expect(parsed).toMatch(/^\d{4}-05-04T/);
    const hour = new Date(parsed).getHours();
    expect(hour).toBe(12);
    expect(new Date(parsed).getMinutes()).toBe(5);
  });

  it('handles 12 AM as midnight', () => {
    const parsed = parseTimestamp('5/4/26, 12:00:00 AM', 2);
    expect(new Date(parsed).getHours()).toBe(0);
  });

  it('throws on garbage', () => {
    expect(() => parseTimestamp('sometime', 7)).toThrow(/row 7/);
    expect(() => parseTimestamp('', 7)).toThrow(/row 7/);
  });
});

describe('parseParticipation', () => {
  it('parses h/m/s combinations', () => {
    expect(parseParticipation('46m 18s')).toBe(2_778_000);
    expect(parseParticipation('1h 2m')).toBe(3_720_000);
    expect(parseParticipation('45s')).toBe(45_000);
    expect(parseParticipation('30 min')).toBe(1_800_000);
  });

  it('throws when nothing is parseable', () => {
    expect(() => parseParticipation('unknown')).toThrow(/participation length/);
  });
});
