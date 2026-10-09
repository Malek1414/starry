import { sampleDir, type Field } from "./field";

/**
 * Struct-of-arrays particle system. Positions are in field-grid coordinates.
 * After each `step`, (px, py) → (x, y) is the segment to draw for particle i,
 * unless `fresh[i]` is 1 (it just respawned and has nothing to draw yet).
 */
export class Particles {
  count = 0;
  x = new Float32Array(0);
  y = new Float32Array(0);
  px = new Float32Array(0);
  py = new Float32Array(0);
  hx = new Float32Array(0);
  hy = new Float32Array(0);
  age = new Float32Array(0);
  life = new Float32Array(0);
  fresh = new Uint8Array(0);
  /** Per-particle brightness, so neighbouring strokes read as separate dabs. */
  tone = new Float32Array(0);
  private dir = { x: 0, y: 0 };

  constructor(
    private field: Field,
    count: number,
    private rand: () => number,
  ) {
    this.resize(count);
  }

  setField(field: Field): void {
    this.field = field;
    for (let i = 0; i < this.count; i++) this.spawn(i);
  }

  /** Grow or shrink in place; existing particles keep flowing. */
  resize(count: number): void {
    const old = this.count;
    const grow = <T extends Float32Array | Uint8Array>(a: T, make: (n: number) => T): T => {
      const b = make(count);
      b.set(a.subarray(0, Math.min(old, count)));
      return b;
    };
    const f32 = (n: number) => new Float32Array(n);
    this.x = grow(this.x, f32);
    this.y = grow(this.y, f32);
    this.px = grow(this.px, f32);
    this.py = grow(this.py, f32);
    this.hx = grow(this.hx, f32);
    this.hy = grow(this.hy, f32);
    this.age = grow(this.age, f32);
    this.life = grow(this.life, f32);
    this.fresh = grow(this.fresh, (n) => new Uint8Array(n));
    this.tone = grow(this.tone, f32);
    this.count = count;
    for (let i = old; i < count; i++) this.spawn(i);
  }

  respawnAll(): void {
    for (let i = 0; i < this.count; i++) this.spawn(i);
  }

  private spawn(i: number): void {
    const f = this.field;
    this.x[i] = this.px[i] = this.rand() * (f.w - 1);
    this.y[i] = this.py[i] = this.rand() * (f.h - 1);
    const a = this.rand() * Math.PI * 2;
    this.hx[i] = Math.cos(a);
    this.hy[i] = Math.sin(a);
    this.age[i] = 0;
    // Staggered lifetimes so respawns don't happen in visible waves.
    this.life[i] = 20 + this.rand() * 60;
    this.fresh[i] = 1;
    this.tone[i] = 0.8 + this.rand() * 0.4;
  }

  /**
   * Advance every particle by `stepLen` grid units along the field.
   * `order` 1 follows the field exactly; 0 wanders freely.
   */
  step(stepLen: number, order: number): void {
    const f = this.field, d = this.dir, chaos = 1 - order;
    for (let i = 0; i < this.count; i++) {
      if (this.age[i] >= this.life[i]) {
        this.spawn(i);
        continue;
      }
      sampleDir(f, this.x[i], this.y[i], d);
      // A direction field has no arrow: keep going the way we were going.
      if (d.x * this.hx[i] + d.y * this.hy[i] < 0) {
        d.x = -d.x;
        d.y = -d.y;
      }
      let dx = d.x, dy = d.y;
      if (chaos > 0) {
        const a = Math.atan2(dy, dx) + (this.rand() - 0.5) * Math.PI * 1.5 * chaos;
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
      this.hx[i] = dx;
      this.hy[i] = dy;
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
      this.x[i] += dx * stepLen;
      this.y[i] += dy * stepLen;
      this.age[i]++;
      this.fresh[i] = 0;
      if (this.x[i] < 0 || this.y[i] < 0 || this.x[i] > f.w - 1 || this.y[i] > f.h - 1) this.spawn(i);
    }
  }
}
