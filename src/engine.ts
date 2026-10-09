import { blurRgb, fitSize, fromRgba, type Rgb } from "./core/image";
import { buildField, type Field } from "./core/field";
import { Particles } from "./core/particles";
import { bucketCss, quantize, strokeColor } from "./core/color";
import { rng } from "./core/noise";

export const NAVY = "#0c1445";

export interface Settings {
  particles: number;
  /** Screen px each particle travels per frame (also sets the brush width). */
  strokeLength: number;
  /** 0..1 */
  colorSharpness: number;
  /** 0..1 */
  order: number;
}

export type Mode = "paint" | "directions";

/** Long side of the grid the direction field is read on. */
const FIELD_MAX = 720;
/** Long side of the colour image strokes are tinted from. */
const COLOR_MAX = 1440;
/** Long side cap for the canvas backing store. */
const CANVAS_MAX = 2048;

interface Picture {
  field: Field;
  sharp: Rgb;
  soft: Rgb;
  aspect: number;
}

/** Reads a picture's brushwork and re-paints it with flowing particles. */
export class Engine {
  readonly ctx: CanvasRenderingContext2D;
  mode: Mode = "paint";
  private pic?: Picture;
  private particles?: Particles;
  private raf = 0;
  private running = false;
  private counts = new Uint32Array(4096);
  private starts = new Uint32Array(4097);
  private order = new Uint32Array(0);
  private bucket = new Uint16Array(0);
  private box = { width: 800, height: 600 };

  constructor(
    readonly canvas: HTMLCanvasElement,
    public settings: Settings,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  get hasPicture(): boolean {
    return !!this.pic;
  }

  /** Analyse a new picture and start painting it from a blank canvas. */
  load(source: CanvasImageSource & { width: number; height: number }): void {
    const sw = source.width, sh = source.height;
    const sharp = rasterize(source, fitSize(sw, sh, COLOR_MAX));
    const small = rasterize(source, fitSize(sw, sh, FIELD_MAX));
    const field = buildField(small, { seed: 1 + Math.floor(Math.random() * 1000) });
    const soft = blurRgb(small, Math.max(2, small.w / 160));
    this.pic = { field, sharp, soft, aspect: sw / sh };
    if (this.particles) this.particles.setField(field);
    else this.particles = new Particles(field, this.settings.particles, rng(42));
    this.fit();
    this.restart();
  }

  /** Size the canvas to fit `box` (CSS px, keeping the picture's aspect); clears on a size change. */
  fit(box: { width: number; height: number } = this.box): void {
    this.box = box;
    if (!this.pic) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = box.width, cssH = box.width / this.pic.aspect;
    if (cssH > box.height) {
      cssH = box.height;
      cssW = cssH * this.pic.aspect;
    }
    const s = Math.min(dpr, CANVAS_MAX / Math.max(cssW, cssH));
    const w = Math.max(1, Math.round(cssW * s)), h = Math.max(1, Math.round(cssH * s));
    this.canvas.style.width = `${Math.round(cssW)}px`;
    this.canvas.style.height = `${Math.round(cssH)}px`;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.clear();
    }
  }

  clear(): void {
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = NAVY;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  restart(): void {
    this.clear();
    this.particles?.respawnAll();
  }

  setParticleCount(n: number): void {
    this.settings.particles = n;
    this.particles?.resize(n);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Advance one step and draw it. Public so tests and recordings can drive it. */
  frame(): void {
    const pic = this.pic, p = this.particles;
    if (!pic || !p) return;
    const { ctx, canvas, settings } = this;
    const f = pic.field;
    const scale = canvas.width / Math.max(1, f.w - 1);
    const pxPerCss = canvas.width / Math.max(1, parseFloat(canvas.style.width) || canvas.width);
    const stepScreen = settings.strokeLength * pxPerCss;
    p.step(stepScreen / scale, settings.order);

    ctx.lineCap = "round";
    ctx.lineWidth = (0.9 + settings.strokeLength * 0.45) * pxPerCss;

    if (this.mode === "directions") {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, 0.8 * pxPerCss);
      ctx.beginPath();
      for (let i = 0; i < p.count; i++) {
        if (p.fresh[i]) continue;
        ctx.moveTo(p.px[i] * scale, p.py[i] * scale);
        ctx.lineTo(p.x[i] * scale, p.y[i] * scale);
      }
      ctx.stroke();
      return;
    }

    // Paint: bucket strokes by quantised colour (counting sort) so the whole
    // frame is a few hundred stroke() calls instead of one per particle.
    if (this.bucket.length < p.count) {
      this.bucket = new Uint16Array(p.count);
      this.order = new Uint32Array(p.count);
    }
    const { counts, starts, bucket, order } = this;
    counts.fill(0);
    for (let i = 0; i < p.count; i++) {
      if (p.fresh[i]) {
        bucket[i] = 0xffff;
        continue;
      }
      const q = quantize(strokeColor(pic.sharp, pic.soft, p.x[i], p.y[i], f.w, f.h, settings.colorSharpness, 1.15, p.tone[i]));
      bucket[i] = q;
      counts[q]++;
    }
    starts[0] = 0;
    for (let q = 0; q < 4096; q++) starts[q + 1] = starts[q] + counts[q];
    const fill = starts.slice(0, 4096);
    for (let i = 0; i < p.count; i++) if (bucket[i] !== 0xffff) order[fill[bucket[i]]++] = i;

    ctx.globalAlpha = 0.75;
    for (let q = 0; q < 4096; q++) {
      const a = starts[q], b = starts[q + 1];
      if (a === b) continue;
      ctx.strokeStyle = bucketCss(q);
      ctx.beginPath();
      for (let k = a; k < b; k++) {
        const i = order[k];
        ctx.moveTo(p.px[i] * scale, p.py[i] * scale);
        ctx.lineTo(p.x[i] * scale, p.y[i] * scale);
      }
      ctx.stroke();
    }
  }
}

/** Draw an image at `size` and read its pixels back as float RGB. */
function rasterize(src: CanvasImageSource, size: { w: number; h: number }): Rgb {
  const c = document.createElement("canvas");
  c.width = size.w;
  c.height = size.h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, size.w, size.h);
  return fromRgba(ctx.getImageData(0, 0, size.w, size.h).data, size.w, size.h);
}
