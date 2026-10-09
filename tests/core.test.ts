import { describe, expect, it } from "vitest";
import { blur, fitSize, fromRgba, type Rgb } from "../src/core/image";
import { buildField, sampleDir } from "../src/core/field";
import { Particles } from "../src/core/particles";
import { bucketCss, quantize, strokeColor } from "../src/core/color";
import { rng } from "../src/core/noise";

/** Grey image from a function of (x, y) → 0..1. */
function grey(w: number, h: number, f: (x: number, y: number) => number): Rgb {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = Math.round(f(x, y) * 255), i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  return fromRgba(data, w, h);
}

const dirAt = (img: Rgb, x: number, y: number) => {
  const f = buildField(img, { swirl: 0 });
  const d = { x: 0, y: 0 };
  sampleDir(f, x, y, d);
  return { d, coh: f.coherence[Math.round(y) * f.w + Math.round(x)] };
};

describe("image", () => {
  it("blur keeps a constant image constant and preserves the mean", () => {
    const src = new Float32Array(30 * 20).fill(0.4);
    const out = blur(src, 30, 20, 3);
    for (const v of out) expect(v).toBeCloseTo(0.4, 5);
  });

  it("fitSize never upscales and keeps aspect", () => {
    expect(fitSize(4000, 3000, 720)).toEqual({ w: 720, h: 540 });
    expect(fitSize(300, 200, 720)).toEqual({ w: 300, h: 200 });
  });
});

describe("field", () => {
  it("runs along vertical stripes", () => {
    const { d, coh } = dirAt(grey(64, 64, (x) => 0.5 + 0.5 * Math.sin(x / 3)), 32, 32);
    expect(Math.abs(d.y)).toBeGreaterThan(0.99);
    expect(coh).toBeGreaterThan(0.9);
  });

  it("runs along horizontal stripes", () => {
    const { d } = dirAt(grey(64, 64, (_x, y) => 0.5 + 0.5 * Math.sin(y / 3)), 32, 32);
    expect(Math.abs(d.x)).toBeGreaterThan(0.99);
  });

  it("circles around concentric rings (like the halos round the stars)", () => {
    const img = grey(96, 96, (x, y) => 0.5 + 0.5 * Math.sin(Math.hypot(x - 48, y - 48) / 2.5));
    for (const [x, y] of [[48 + 25, 48], [48, 48 + 25], [48 - 18, 48 - 18]]) {
      const { d } = dirAt(img, x, y);
      const rx = (x - 48) / Math.hypot(x - 48, y - 48), ry = (y - 48) / Math.hypot(x - 48, y - 48);
      // Tangent ⟂ radius.
      expect(Math.abs(d.x * rx + d.y * ry)).toBeLessThan(0.15);
    }
  });

  it("has no clear direction on a flat image, and swirl fills it in", () => {
    const flat = grey(40, 40, () => 0.5);
    expect(dirAt(flat, 20, 20).coh).toBe(0);
    const f = buildField(flat, { swirl: 1 });
    const d = { x: 0, y: 0 };
    sampleDir(f, 20, 20, d);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 5);
  });

  it("interpolates orientation across the ±π wrap without collapsing", () => {
    // Doubled-angle storage: a cell at θ≈0 and a cell at θ≈π are the same line.
    const f = { w: 2, h: 1, c2: new Float32Array([1, 1]), s2: new Float32Array([0.01, -0.01]), coherence: new Float32Array(2) };
    const d = { x: 0, y: 0 };
    sampleDir(f, 0.5, 0, d);
    expect(Math.abs(d.x)).toBeGreaterThan(0.99);
  });
});

describe("particles", () => {
  const field = buildField(grey(50, 40, (x) => 0.5 + 0.5 * Math.sin(x / 3)), { swirl: 0 });

  it("stay inside the grid and move one step per tick", () => {
    const p = new Particles(field, 500, rng(7));
    // Collect violations and assert once: 100k expect() calls are slow enough
    // to trip the test timeout on a busy machine.
    const outside: string[] = [], wrongStep: string[] = [];
    for (let t = 0; t < 200; t++) {
      p.step(1.5, 1);
      for (let i = 0; i < p.count; i++) {
        if (p.x[i] < 0 || p.x[i] > field.w - 1 || p.y[i] < 0 || p.y[i] > field.h - 1) outside.push(`${t}:${i}`);
        if (!p.fresh[i] && Math.abs(Math.hypot(p.x[i] - p.px[i], p.y[i] - p.py[i]) - 1.5) > 1e-4) wrongStep.push(`${t}:${i}`);
      }
    }
    expect(outside).toEqual([]);
    expect(wrongStep).toEqual([]);
  });

  it("follow the field at full order and keep their heading (no back-and-forth)", () => {
    const p = new Particles(field, 200, rng(3));
    p.step(1, 1);
    const hy = Array.from(p.hy);
    p.step(1, 1);
    for (let i = 0; i < p.count; i++) {
      if (p.fresh[i] || p.age[i] < 2) continue;
      expect(Math.abs(p.hy[i])).toBeGreaterThan(0.95); // vertical stripes → vertical motion
      expect(Math.sign(p.hy[i])).toBe(Math.sign(hy[i]));
    }
  });

  it("resize keeps existing particles and adds new ones", () => {
    const p = new Particles(field, 100, rng(1));
    p.step(1, 1);
    const x5 = p.x[5];
    p.resize(300);
    expect(p.count).toBe(300);
    expect(p.x[5]).toBe(x5);
    p.resize(50);
    expect(p.x.length).toBe(50);
  });
});

describe("color", () => {
  const sharp = fromRgba(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]), 2, 1);
  const soft = fromRgba(new Uint8ClampedArray([0, 255, 0, 255, 0, 255, 0, 255]), 2, 1);

  it("mixes sharp and soft by sharpness", () => {
    expect(strokeColor(sharp, soft, 0, 0, 2, 1, 1, 1)).toBe(0xff0000);
    expect(strokeColor(sharp, soft, 0, 0, 2, 1, 0, 1)).toBe(0x00ff00);
    expect(strokeColor(sharp, soft, 1, 0, 2, 1, 1, 1)).toBe(0x0000ff);
  });

  it("quantizes to 4-bit buckets and back", () => {
    expect(quantize(0xff8800)).toBe(0xf80);
    expect(bucketCss(0xf80)).toBe("rgb(255,136,0)");
  });
});

describe("tone", () => {
  it("scales brightness per particle and gives each particle its own tone", () => {
    const img = fromRgba(new Uint8ClampedArray([200, 100, 50, 255]), 1, 1);
    expect(strokeColor(img, img, 0, 0, 1, 1, 1, 1, 0.5)).toBe((100 << 16) | (50 << 8) | 25);
    const p = new Particles(buildField(grey(20, 20, () => 0.5)), 100, rng(2));
    const tones = new Set(Array.from(p.tone, (t) => t.toFixed(3)));
    expect(tones.size).toBeGreaterThan(50);
    for (const t of p.tone) expect(t).toBeGreaterThanOrEqual(0.8);
  });
});
