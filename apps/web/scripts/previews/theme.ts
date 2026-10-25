/** Design tokens mirrored from the web app's Tailwind palette (both themes). */

export interface BadgeColors {
  bg: string;
  fg: string;
}

export interface Palette {
  bg: string;
  chromeBar: string;
  chromeBorder: string;
  urlPill: string;
  card: string;
  border: string;
  strong: string;
  text: string;
  sub: string;
  faint: string;
  inputBg: string;
  inputBorder: string;
  theadBg: string;
  theadText: string;
  divider: string;
  rowTint: string;
  accent: string;
  track: string;
  knob: string;
  danger: string;
  onlineValue: string;
  leftValue: string;
  absentValue: string;
  lateValue: string;
  barGood: string;
  barMid: string;
  barBad: string;
  dot: { online: string; left: string; absent: string; scheduled: string; ended: string };
  badge: {
    online: BadgeColors;
    left: BadgeColors;
    absent: BadgeColors;
    late: BadgeColors;
    unstable: BadgeColors;
  };
  activity: { joinBg: string; joinFg: string; leaveBg: string; leaveFg: string };
  shadow: string;
}

export const LIGHT: Palette = {
  bg: '#f8fafc',
  chromeBar: '#e2e8f0',
  chromeBorder: '#cbd5e1',
  urlPill: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  strong: '#0f172a',
  text: '#334155',
  sub: '#64748b',
  faint: '#94a3b8',
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  theadBg: '#f1f5f9',
  theadText: '#64748b',
  divider: '#e2e8f0',
  rowTint: '#f0fdf4',
  accent: '#0369a1',
  track: '#e2e8f0',
  knob: '#0ea5e9',
  danger: '#dc2626',
  onlineValue: '#16a34a',
  leftValue: '#d97706',
  absentValue: '#64748b',
  lateValue: '#ea580c',
  barGood: '#22c55e',
  barMid: '#f59e0b',
  barBad: '#f87171',
  dot: {
    online: '#22c55e',
    left: '#f59e0b',
    absent: '#94a3b8',
    scheduled: '#0ea5e9',
    ended: '#94a3b8',
  },
  badge: {
    online: { bg: '#dcfce7', fg: '#166534' },
    left: { bg: '#fef3c7', fg: '#92400e' },
    absent: { bg: '#f1f5f9', fg: '#475569' },
    late: { bg: '#ffedd5', fg: '#9a3412' },
    unstable: { bg: '#f3e8ff', fg: '#6b21a8' },
  },
  activity: { joinBg: '#dcfce7', joinFg: '#15803d', leaveBg: '#fef3c7', leaveFg: '#b45309' },
  shadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

export const DARK: Palette = {
  bg: '#0f172a',
  chromeBar: '#162032',
  chromeBorder: '#334155',
  urlPill: '#1e293b',
  card: '#1e293b',
  border: '#334155',
  strong: '#f8fafc',
  text: '#e2e8f0',
  sub: '#94a3b8',
  faint: '#64748b',
  inputBg: '#334155',
  inputBorder: '#475569',
  theadBg: '#334155',
  theadText: '#cbd5e1',
  divider: '#334155',
  rowTint: '#142119',
  accent: '#0369a1',
  track: '#475569',
  knob: '#0ea5e9',
  danger: '#f87171',
  onlineValue: '#4ade80',
  leftValue: '#fbbf24',
  absentValue: '#94a3b8',
  lateValue: '#fb923c',
  barGood: '#22c55e',
  barMid: '#f59e0b',
  barBad: '#f87171',
  dot: {
    online: '#22c55e',
    left: '#f59e0b',
    absent: '#94a3b8',
    scheduled: '#0ea5e9',
    ended: '#94a3b8',
  },
  badge: {
    online: { bg: '#14532d', fg: '#bbf7d0' },
    left: { bg: '#78350f', fg: '#fde68a' },
    absent: { bg: '#334155', fg: '#cbd5e1' },
    late: { bg: '#7c2d12', fg: '#fdba74' },
    unstable: { bg: '#581c87', fg: '#e9d5ff' },
  },
  activity: { joinBg: '#14532d', joinFg: '#4ade80', leaveBg: '#78350f', leaveFg: '#fbbf24' },
  shadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
};

export const WIDTH = 1200;
export const BANNER_HEIGHT = 260;
