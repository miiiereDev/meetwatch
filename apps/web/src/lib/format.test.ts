import { describe, expect, it } from 'vitest';
import { formatDuration, formatRelative, formatTime, percentLabel } from './format';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('pads seconds and minutes', () => {
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('includes hours past one hour', () => {
    expect(formatDuration(3_723_000)).toBe('1:02:03');
  });

  it('coerces negative and non-finite input to zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('formatTime', () => {
  it('returns a time string for a valid ISO date', () => {
    expect(formatTime('2026-05-04T09:30:00.000Z')).not.toBe('—');
  });

  it('returns a dash for null, undefined and garbage', () => {
    expect(formatTime(null)).toBe('—');
    expect(formatTime(undefined)).toBe('—');
    expect(formatTime('not-a-date')).toBe('—');
  });
});

describe('formatRelative', () => {
  it('describes future offsets', () => {
    expect(formatRelative(0, 120_000)).toBe('in 2 min');
  });

  it('describes past offsets', () => {
    expect(formatRelative(300_000, 0)).toBe('5 min ago');
  });

  it('handles sub-minute gaps', () => {
    expect(formatRelative(0, 10_000)).toBe('in less than a minute');
  });
});

describe('percentLabel', () => {
  it('rounds to the nearest whole percent', () => {
    expect(percentLabel(73.6)).toBe('74%');
  });
});
