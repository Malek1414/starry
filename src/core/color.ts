import type { Rgb } from "./image";

/**
 * Stroke colour at grid position (gx, gy) of a `gridW`×`gridH` field.
 * `sharp` and `soft` may be at different resolutions; positions are scaled.
 * `sharpness` 1 = the exact pixel colour, 0 = the softened neighbourhood.
 * `tone` scales brightness (per-particle variation).
 * Returns 0xRRGGBB.
 */
export function strokeColor(
  sharp: Rgb, soft: Rgb, gx: number, gy: number, gridW: number, gridH: number, sharpness: number,
  saturation = 1.15,
  tone = 1,
): number {
  const a = pick(sharp, gx, gy, gridW, gridH);
  const b = pick(soft, gx, gy, gridW, gridH);
  let r = sharp.r[a] * sharpness + soft.r[b] * (1 - sharpness);
  let g = sharp.g[a] * sharpness + soft.g[b] * (1 - sharpness);
  let bl = sharp.b[a] * sharpness + soft.b[b] * (1 - sharpness);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  r = l + (r - l) * saturation;
  g = l + (g - l) * saturation;
  bl = l + (bl - l) * saturation;
  r *= tone;
  g *= tone;
  bl *= tone;
  return (to255(r) << 16) | (to255(g) << 8) | to255(bl);
}

function pick(img: Rgb, gx: number, gy: number, gridW: number, gridH: number): number {
  const x = Math.min(img.w - 1, Math.max(0, Math.round((gx / Math.max(1, gridW - 1)) * (img.w - 1))));
  const y = Math.min(img.h - 1, Math.max(0, Math.round((gy / Math.max(1, gridH - 1)) * (img.h - 1))));
  return y * img.w + x;
}

const to255 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

/** Drop to 4 bits per channel so strokes can be batched into few paths. */
export const quantize = (rgb: number) => ((rgb >> 20) & 0xf) << 8 | ((rgb >> 12) & 0xf) << 4 | ((rgb >> 4) & 0xf);

/** Inverse of `quantize`: bucket → CSS colour string. */
export function bucketCss(q: number): string {
  const r = ((q >> 8) & 0xf) * 17, g = ((q >> 4) & 0xf) * 17, b = (q & 0xf) * 17;
  return `rgb(${r},${g},${b})`;
}
