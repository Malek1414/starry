/** An RGB image on a working grid, channels as 0..1 floats, row-major. */
export interface Rgb {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
}

/** RGBA bytes (as from ImageData) → float channels. */
export function fromRgba(data: Uint8ClampedArray | Uint8Array, w: number, h: number): Rgb {
  const n = w * h;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = data[i * 4] / 255;
    g[i] = data[i * 4 + 1] / 255;
    b[i] = data[i * 4 + 2] / 255;
  }
  return { w, h, r, g, b };
}

/** Rec. 709 luminance. */
export function luminance(img: Rgb): Float32Array {
  const n = img.w * img.h;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.2126 * img.r[i] + 0.7152 * img.g[i] + 0.0722 * img.b[i];
  return out;
}

function kernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

/** Separable Gaussian blur with clamped edges. Returns a new array. */
export function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0) return src.slice();
  const k = kernel(sigma);
  const radius = (k.length - 1) / 2;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -radius; j <= radius; j++) {
        const xx = x + j < 0 ? 0 : x + j >= w ? w - 1 : x + j;
        s += src[row + xx] * k[j + radius];
      }
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -radius; j <= radius; j++) {
        const yy = y + j < 0 ? 0 : y + j >= h ? h - 1 : y + j;
        s += tmp[yy * w + x] * k[j + radius];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

export function blurRgb(img: Rgb, sigma: number): Rgb {
  return {
    w: img.w,
    h: img.h,
    r: blur(img.r, img.w, img.h, sigma),
    g: blur(img.g, img.w, img.h, sigma),
    b: blur(img.b, img.w, img.h, sigma),
  };
}

/** Size that fits `w`×`h` inside a `max` long side, never upscaling. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}
