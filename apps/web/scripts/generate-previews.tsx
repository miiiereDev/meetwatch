/**
 * Generates the README's UI previews as self-contained SVGs (satori renders
 * JSX with text as vector outlines — no browser, no screenshots). Data comes
 * from a fixture shaped exactly like the API's SessionReport, mirroring a
 * real simulator run.
 *
 * Usage: pnpm previews   (writes docs/screenshots/*.svg)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import satori from 'satori';
import { DARK, LIGHT, BANNER_HEIGHT, WIDTH } from './previews/theme.js';
import type { Palette } from './previews/theme.js';
import { BannerView, DashboardView, HistoryView, SettingsView } from './previews/views.js';

const OUT_DIR = path.resolve(import.meta.dirname, '../../../docs/screenshots');

/** View heights tuned to their fixed content; bump when adding rows. */
const HEIGHTS = { banner: BANNER_HEIGHT, dashboard: 1320, history: 830, settings: 880 };

interface FontEntry {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: 'normal';
}

function loadFonts(): FontEntry[] {
  const dir = path.join(import.meta.dirname, '../node_modules/@fontsource/inter/files');
  const weights: FontEntry['weight'][] = [400, 500, 600, 700];
  return weights.map((weight) => ({
    name: 'Inter',
    data: readFileSync(path.join(dir, `inter-latin-${weight}-normal.woff`)),
    weight,
    style: 'normal' as const,
  }));
}

async function render(element: ReactNode, height: number, fonts: FontEntry[]): Promise<string> {
  return satori(element, { width: WIDTH, height, fonts });
}

async function main(): Promise<void> {
  const fonts = loadFonts();
  mkdirSync(OUT_DIR, { recursive: true });

  const themes: { suffix: string; palette: Palette }[] = [
    { suffix: 'light', palette: LIGHT },
    { suffix: 'dark', palette: DARK },
  ];

  const views = [
    {
      name: 'banner',
      height: HEIGHTS.banner,
      build: (p: Palette) => BannerView({ p, dark: p === DARK }),
    },
    { name: 'dashboard', height: HEIGHTS.dashboard, build: (p: Palette) => DashboardView({ p }) },
    { name: 'history', height: HEIGHTS.history, build: (p: Palette) => HistoryView({ p }) },
    { name: 'settings', height: HEIGHTS.settings, build: (p: Palette) => SettingsView({ p }) },
  ];

  for (const { suffix, palette } of themes) {
    for (const view of views) {
      const svg = await render(view.build(palette), view.height, fonts);
      const file = path.join(OUT_DIR, `${view.name}-${suffix}.svg`);
      writeFileSync(file, svg);
      console.log(`wrote ${file} (${(svg.length / 1024).toFixed(0)} kB)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
