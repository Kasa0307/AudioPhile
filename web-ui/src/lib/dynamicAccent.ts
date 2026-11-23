import { useEffect } from 'react';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { artworkAtPixels } from './artwork';

export interface DynamicPalette {
  accentRgb: string;
  accentHex: string;
  accentBright: string;
  ambientRgb: string;
}

/** Signature Cobalt / Ice-Blue fallback when idle or if CORS blocks artwork pixel extraction. */
export const FALLBACK_PALETTE: DynamicPalette = {
  accentRgb: '75, 114, 230',
  accentHex: '#4b72e6',
  accentBright: '#a4c4ff',
  ambientRgb: '52, 88, 198',
};

const paletteCache = new Map<string, DynamicPalette>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, tRaw: number) => {
    let t = tRaw;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Extracts a vibrant, readable Hi-Fi accent + soft ambient glow color from album art.
 * Safely falls back to Cobalt/Ice-Blue on CORS blocks, monochrome/pitch-black covers, or load failure.
 */
async function extractDynamicPalette(url: string): Promise<DynamicPalette> {
  const cached = paletteCache.get(url);
  if (cached) return cached;

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.referrerPolicy = 'no-referrer';
  image.decoding = 'async';
  image.src = artworkAtPixels(url, 80);

  await image.decode();

  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return FALLBACK_PALETTE;

  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let bestScore = -1;
  let bestH = 0.62;
  let bestS = 0.72;
  let bestL = 0.58;

  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 255;
    if (a < 180) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    avgR += r;
    avgG += g;
    avgB += b;
    count++;

    const [h, s, l] = rgbToHsl(r, g, b);
    // Prefer rich mid-lightness saturated hues; ignore near-black / near-white noise.
    const lWeight = 1 - Math.abs(l - 0.52) * 1.8;
    const score = s * 1.6 + Math.max(0, lWeight) * 0.7;
    if (s > 0.14 && l > 0.12 && l < 0.88 && score > bestScore) {
      bestScore = score;
      bestH = h;
      bestS = s;
      bestL = l;
    }
  }

  // Monochrome / grayscale cover (e.g., Cigarettes After Sex): keep refined silver-cobalt glow.
  if (bestScore < 0.36 || count === 0) {
    paletteCache.set(url, FALLBACK_PALETTE);
    return FALLBACK_PALETTE;
  }

  // Clamp accent saturation & lightness so buttons/waveforms stay luminous and legible on #07090F.
  const clampedS = Math.min(0.84, Math.max(0.48, bestS * 1.05));
  const clampedL = Math.min(0.62, Math.max(0.48, bestL));
  const [ar, ag, ab] = hslToRgb(bestH, clampedS, clampedL);
  const [br, bg, bb] = hslToRgb(bestH, Math.min(0.9, clampedS + 0.08), Math.min(0.82, clampedL + 0.22));

  // Soft ambient mesh blends extracted hue with average tone so top-of-screen wash feels organic.
  const [avgH, avgS] = rgbToHsl(avgR / count, avgG / count, avgB / count);
  const meshH = avgS > 0.18 ? avgH : bestH;
  const [mr, mg, mb] = hslToRgb(meshH, Math.min(0.75, Math.max(0.38, clampedS * 0.85)), 0.46);

  const palette: DynamicPalette = {
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentHex: toHex(ar, ag, ab),
    accentBright: toHex(br, bg, bb),
    ambientRgb: `${mr}, ${mg}, ${mb}`,
  };
  paletteCache.set(url, palette);
  return palette;
}

function applyPaletteToRoot(palette: DynamicPalette, ambientEnabled: boolean): void {
  const root = document.documentElement;
  const active = ambientEnabled ? palette : FALLBACK_PALETTE;
  root.style.setProperty('--accent-rgb', active.accentRgb);
  root.style.setProperty('--accent-hex', active.accentHex);
  root.style.setProperty('--accent-bright', active.accentBright);
  root.style.setProperty('--ambient-rgb', active.ambientRgb);
  root.style.setProperty('--ambient-opacity', ambientEnabled ? '0.20' : '0');
  // Synchronize existing keyColor design tokens so active controls inherit album color globally.
  root.style.setProperty('--keyColor', active.accentHex);
  root.style.setProperty('--keyColor-rgb', active.accentRgb);
  root.style.setProperty('--keyColorBG', active.accentHex);
  root.style.setProperty('--selectionColor', active.accentHex);
}

/** Syncs the active track's artwork color into root CSS variables with CORS-safe idle fallback. */
export function useDynamicThemeSync(): void {
  const artworkUrl = usePlayer((s) => s.nowPlaying?.artworkUrl ?? null);
  const dynamicAmbient = useUi((s) => s.dynamicAmbient);

  useEffect(() => {
    if (!dynamicAmbient || !artworkUrl) {
      applyPaletteToRoot(FALLBACK_PALETTE, dynamicAmbient);
      return;
    }

    let live = true;
    const cached = paletteCache.get(artworkUrl);
    if (cached) {
      applyPaletteToRoot(cached, true);
      return;
    }

    extractDynamicPalette(artworkUrl)
      .then((palette) => {
        if (live) applyPaletteToRoot(palette, true);
      })
      .catch(() => {
        if (live) applyPaletteToRoot(FALLBACK_PALETTE, true);
      });

    return () => {
      live = false;
    };
  }, [artworkUrl, dynamicAmbient]);
}
