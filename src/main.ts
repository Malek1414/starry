import "./style.css";
import { Engine, type Mode, type Settings } from "./engine";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const status = $("status");
const panel = $("panel");
const fileInput = $<HTMLInputElement>("file");
const recordBtn = $<HTMLButtonElement>("record");

const DEFAULTS: Settings = { particles: 4000, strokeLength: 2.5, colorSharpness: 0.8, order: 1 };
const STORE = "starry.settings";

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved && typeof saved === "object") return { ...DEFAULTS, ...saved };
  } catch {
    /* private mode or bad JSON: use defaults */
  }
  return { ...DEFAULTS };
}
function saveSettings(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(engine.settings));
  } catch {
    /* not essential */
  }
}

const engine = new Engine(canvas, loadSettings());

// ---------- sliders ----------
interface Knob {
  id: string;
  get: (s: Settings) => number;
  set: (v: number) => void;
  show: (v: number) => string;
}
const knobs: Knob[] = [
  { id: "particles", get: (s) => s.particles, set: (v) => engine.setParticleCount(v), show: (v) => String(v) },
  { id: "stroke", get: (s) => s.strokeLength, set: (v) => (engine.settings.strokeLength = v), show: (v) => `${v.toFixed(1)} px` },
  { id: "sharpness", get: (s) => s.colorSharpness * 100, set: (v) => (engine.settings.colorSharpness = v / 100), show: (v) => `${Math.round(v)}%` },
  { id: "order", get: (s) => s.order * 100, set: (v) => (engine.settings.order = v / 100), show: (v) => `${Math.round(v)}%` },
];
const outIds: Record<string, string> = { particles: "particles-out", stroke: "stroke-out", sharpness: "sharpness-out", order: "order-out" };

for (const k of knobs) {
  const input = $<HTMLInputElement>(k.id);
  const out = $(outIds[k.id]);
  const paint = () => {
    const v = Number(input.value);
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty("--p", `${((v - min) / (max - min)) * 100}%`);
    out.textContent = k.show(v);
  };
  input.value = String(k.get(engine.settings));
  paint();
  input.addEventListener("input", () => {
    k.set(Number(input.value));
    paint();
    saveSettings();
  });
}

// ---------- layout ----------
const isPhone = () => window.matchMedia("(max-width: 640px)").matches;
const isWide = () => window.matchMedia("(min-width: 1000px)").matches;
const stage = $("stage");
function layout(): void {
  // Below the wide breakpoint the card is docked at the bottom, so the stage
  // ends where the card begins and the picture is never covered.
  if (isWide()) stage.style.bottom = "";
  else stage.style.bottom = `${window.innerHeight - panel.getBoundingClientRect().top}px`;
  const r = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
  const width = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const height = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  engine.fit({ width: Math.max(120, width), height: Math.max(120, height) });
}
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(layout, 120);
});

$("panel-toggle").addEventListener("click", (e) => {
  const collapsed = panel.classList.toggle("collapsed");
  (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(!collapsed));
  layout();
});

// ---------- loading pictures ----------
let sayTimer = 0;
/** Show a status line; with `ms`, it clears itself (used for confirmations). */
function say(msg: string, ms = 0): void {
  clearTimeout(sayTimer);
  status.textContent = msg;
  if (ms) sayTimer = window.setTimeout(() => (status.textContent = ""), ms);
}

async function show(source: Blob | string, label: string): Promise<void> {
  say("Reading the brushwork…");
  try {
    const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
    const bitmap = await createImageBitmap(blob);
    // Let the status paint before the (synchronous) analysis blocks the thread.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    engine.load(bitmap);
    bitmap.close();
    layout();
    engine.restart();
    engine.start();
    say("");
    document.title = `Starry · ${label}`;
  } catch (err) {
    console.error(err);
    say("Couldn't read that image. Try a JPEG or PNG.");
  }
}

const VAN_GOGH = new URL("starry-night.jpg", document.baseURI).href;

$("choose").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void show(file, file.name.replace(/\.[^.]+$/, ""));
  fileInput.value = "";
});
$("vangogh").addEventListener("click", () => void show(VAN_GOGH, "The Starry Night"));
$("restart").addEventListener("click", () => engine.restart());

// Drag and drop, and paste, anywhere on the page.
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  dragDepth++;
  document.body.classList.add("dragging");
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    document.body.classList.remove("dragging");
  }
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove("dragging");
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
  if (file) void show(file, file.name.replace(/\.[^.]+$/, ""));
});
window.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
  const file = item?.getAsFile();
  if (file) void show(file, "Pasted image");
});

// ---------- mode ----------
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")];
for (const btn of modeButtons) {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode as Mode;
    if (mode === engine.mode) return;
    engine.mode = mode;
    for (const b of modeButtons) b.setAttribute("aria-pressed", String(b === btn));
    engine.restart();
  });
}

// ---------- save ----------
function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

async function deliver(blob: Blob, name: string, done: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  // Phones: the share sheet lets people save straight to Photos.
  if (isPhone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Starry" });
      say(done, 1600);
      return;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  say(done, 1600);
}

$("save").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (blob) void deliver(blob, `starry-${stamp()}.png`, "Saved");
  }, "image/png");
});

// ---------- record ----------
const CLIP_SECONDS = 6;
function recorderType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}
if (!recorderType() || !("captureStream" in canvas)) recordBtn.disabled = true;

recordBtn.addEventListener("click", () => {
  const type = recorderType();
  if (!type || recordBtn.classList.contains("recording")) return;
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "Record clip";
    const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
    void deliver(new Blob(chunks, { type: type.split(";")[0] }), `starry-${stamp()}.${ext}`, "Clip saved");
  };
  // Start from a blank canvas so the clip shows the painting appear.
  engine.restart();
  rec.start(250);
  recordBtn.classList.add("recording");
  let left = CLIP_SECONDS;
  recordBtn.textContent = `Recording ${left}s`;
  const timer = setInterval(() => {
    left--;
    if (left > 0) recordBtn.textContent = `Recording ${left}s`;
    else {
      clearInterval(timer);
      rec.stop();
    }
  }, 1000);
});

// Quiet at rest: on a mouse/trackpad the card dims after a few idle seconds
// (CSS keeps it lit while hovered or focused) and wakes on any movement.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let restTimer = 0;
  const wake = () => {
    panel.classList.remove("resting");
    clearTimeout(restTimer);
    restTimer = window.setTimeout(() => panel.classList.add("resting"), 3000);
  };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) window.addEventListener(ev, wake, { passive: true });
  wake();
}

// Pause when the tab is hidden so phones don't burn battery in the background.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) engine.stop();
  else if (engine.hasPicture) engine.start();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

layout();
void show(VAN_GOGH, "The Starry Night");
