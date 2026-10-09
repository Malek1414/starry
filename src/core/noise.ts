/** Small seeded value noise, smooth enough to steer strokes. Returns 0..1. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const fade = (t: number) => t * t * (3 - 2 * t);

function value(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = fade(x - x0), ty = fade(y - y0);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

/** Two octaves of value noise. */
export function noise2(x: number, y: number, seed = 1): number {
  return value(x, y, seed) * 0.67 + value(x * 2.1 + 17.3, y * 2.1 - 9.1, seed + 1) * 0.33;
}

/** Deterministic PRNG (mulberry32) so tests and restarts are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
