import "./style.css";
import { Engine, type Settings } from "./engine";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const status = $("status");
const panel = $("panel");
const fileInput = $<HTMLInputElement>("file");
const modeBtn = $<HTMLButtonElement>("mode");
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
function layout(): void {
  const pad = 16;
  let height = window.innerHeight - pad * 2;
  // On a phone the card sits under the picture instead of over it.
  const stage = $("stage");
  if (isPhone()) {
    const cardH = panel.getBoundingClientRect().height;
    height -= cardH;
    stage.style.bottom = `${cardH}px`;
  } else {
    stage.style.bottom = "";
  }
  engine.fit({ width: window.innerWidth - pad * 2, height: Math.max(120, height) });
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
function say(msg: string): void {
  status.textContent = msg;
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
modeBtn.addEventListener("click", () => {
  engine.mode = engine.mode === "paint" ? "directions" : "paint";
  const on = engine.mode === "directions";
  modeBtn.setAttribute("aria-pressed", String(on));
  modeBtn.textContent = on ? "Paint" : "Directions";
  engine.restart();
});

// ---------- save ----------
function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

async function deliver(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  // Phones: the share sheet lets people save straight to Photos.
  if (isPhone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Starry" });
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
}

$("save").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (blob) void deliver(blob, `starry-${stamp()}.png`);
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
    void deliver(new Blob(chunks, { type: type.split(";")[0] }), `starry-${stamp()}.${ext}`);
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
