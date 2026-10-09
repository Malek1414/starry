import { blur, luminance, type Rgb } from "./image";
import { noise2 } from "./noise";

/**
 * Direction field read from a picture: at every grid cell, the direction its
 * brushwork (edges, swirls, contours) runs in.
 *
 * Orientation is stored doubled, as (cos 2θ, sin 2θ): a stroke along θ and one
 * along θ+π are the same line, and the doubled form lets bilinear sampling
 * average orientations without them cancelling out.
 */
export interface Field {
  w: number;
  h: number;
  c2: Float32Array;
  s2: Float32Array;
  /** 0 = no clear direction (flat area), 1 = strong, consistent direction. */
  coherence: Float32Array;
}

export interface FieldOptions {
  /** Smoothing of the structure tensor, as a fraction of the long side. */
  scale?: number;
  /** How strongly flat areas get turned into swirling eddies, 0..1. */
  swirl?: number;
  /** Seed for the swirl noise. */
  seed?: number;
}

export function buildField(img: Rgb, opts: FieldOptions = {}): Field {
  const { w, h } = img;
  const scale = opts.scale ?? 0.012;
  const swirl = opts.swirl ?? 0.85;
  const seed = opts.seed ?? 1;
  const lum = blur(luminance(img), w, h, 1);

  // Sobel gradients → structure tensor.
  const n = w * h;
  const jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
  const at = (x: number, y: number) =>
    lum[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const i = y * w + x;
      jxx[i] = gx * gx;
      jxy[i] = gx * gy;
      jyy[i] = gy * gy;
    }
  }
  const sigma = Math.max(1.5, scale * Math.max(w, h));
  const sxx = blur(jxx, w, h, sigma), sxy = blur(jxy, w, h, sigma), syy = blur(jyy, w, h, sigma);

  const c2 = new Float32Array(n), s2 = new Float32Array(n), coherence = new Float32Array(n);
  // ~7 eddies across the long side: Van Gogh-sized swirls in skies and walls.
  const noiseFreq = 7 / Math.max(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = sxx[i] - syy[i], b = 2 * sxy[i];
      const mag = Math.hypot(a, b);
      const trace = sxx[i] + syy[i];
      // The gradient's doubled angle is atan2(b, a); edges run perpendicular
      // to the gradient, which in doubled form is a sign flip.
      let cx = mag > 1e-9 ? -a / mag : 0;
      let cy = mag > 1e-9 ? -b / mag : 0;
      const coh = trace > 1e-9 ? Math.min(1, mag / trace) : 0;

      // Flat areas: lean on a smooth noise angle so they swirl instead of
      // freezing. Weight falls off as the picture's own direction gets clear.
      const wNoise = swirl * (1 - coh) * (1 - coh);
      if (wNoise > 0) {
        const ang = noise2(x * noiseFreq, y * noiseFreq, seed) * Math.PI * 4;
        cx = cx * (1 - wNoise) + Math.cos(ang) * wNoise;
        cy = cy * (1 - wNoise) + Math.sin(ang) * wNoise;
        const m = Math.hypot(cx, cy) || 1;
        cx /= m;
        cy /= m;
      }
      c2[i] = cx;
      s2[i] = cy;
      coherence[i] = coh;
    }
  }
  return { w, h, c2, s2, coherence };
}

/**
 * Direction (unit vector) at a fractional grid position, bilinear in the
 * doubled-angle space. The sign is ambiguous; callers pick the one that
 * agrees with where they were heading.
 */
export function sampleDir(f: Field, x: number, y: number, out: { x: number; y: number }): void {
  const fx = x < 0 ? 0 : x > f.w - 1 ? f.w - 1 : x;
  const fy = y < 0 ? 0 : y > f.h - 1 ? f.h - 1 : y;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = x0 + 1 < f.w ? x0 + 1 : x0, y1 = y0 + 1 < f.h ? y0 + 1 : y0;
  const tx = fx - x0, ty = fy - y0;
  const i00 = y0 * f.w + x0, i10 = y0 * f.w + x1, i01 = y1 * f.w + x0, i11 = y1 * f.w + x1;
  const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
  const c = f.c2[i00] * w00 + f.c2[i10] * w10 + f.c2[i01] * w01 + f.c2[i11] * w11;
  const s = f.s2[i00] * w00 + f.s2[i10] * w10 + f.s2[i01] * w01 + f.s2[i11] * w11;
  const theta = Math.atan2(s, c) / 2;
  out.x = Math.cos(theta);
  out.y = Math.sin(theta);
}
