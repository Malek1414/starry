// Functional smoke test, run inside the page (e.g. paste into DevTools, or
// evaluate through a browser driver). It drives every control the way a person
// would and reports what happened, so a visual change can be checked against
// the same behaviour before and after.
//
// Returns { pass: boolean, checks: { name: true | "failure detail" } }.
async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const checks = {};
  const check = (name, ok, detail = "") => (checks[name] = ok ? true : detail || false);
  const until = async (fn, ms = 8000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (fn()) return true;
      await sleep(100);
    }
    return false;
  };
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const pixels = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const isNavy = (d, i) => Math.abs(d[i] - 12) < 3 && Math.abs(d[i + 1] - 20) < 3 && Math.abs(d[i + 2] - 69) < 3;
  const navyShare = () => {
    const d = pixels();
    let n = 0, t = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { t++; if (isNavy(d, i)) n++; }
    return n / t;
  };
  const greyShare = () => {
    const d = pixels();
    let n = 0, t = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      t++;
      if (d[i] > 60 && Math.abs(d[i] - d[i + 1]) < 14 && Math.abs(d[i + 1] - d[i + 2]) < 40) n++;
    }
    return n / t;
  };
  // Capture downloads instead of saving files.
  const downloads = [];
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) downloads.push(this.download);
    else realClick.call(this);
  };
  // The mode control: either one toggle button (#mode) or a segmented pair.
  const setMode = (mode) => {
    const seg = document.querySelector(`[data-mode="${mode}"]`);
    if (seg) return seg.click();
    const btn = $("mode");
    const on = btn.getAttribute("aria-pressed") === "true";
    if ((mode === "directions") !== on) btn.click();
  };

  try {
    check("loads Van Gogh", await until(() => document.title.includes("Starry Night") && !$("status").textContent));
    check("canvas sized", canvas.width > 100 && canvas.height > 100, `${canvas.width}x${canvas.height}`);
    await sleep(800);
    check("paints", navyShare() < 0.5, `navy share ${navyShare().toFixed(2)}`);

    const knobs = [
      ["particles", "6000", "6000", "particles", 6000],
      ["stroke", "4.2", "4.2 px", "strokeLength", 4.2],
      ["sharpness", "40", "40%", "colorSharpness", 0.4],
      ["order", "70", "70%", "order", 0.7],
    ];
    for (const [id, value, shown, key, stored] of knobs) {
      const input = $(id);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const out = $(`${id}-out`).textContent;
      const saved = JSON.parse(localStorage.getItem("starry.settings") || "{}")[key];
      check(`slider ${id}`, out === shown && Math.abs(saved - stored) < 1e-6, `shown "${out}", saved ${saved}`);
    }

    $("restart").click();
    check("restart clears", navyShare() > 0.95, `navy share ${navyShare().toFixed(2)}`);
    await sleep(1000);
    check("repaints after restart", navyShare() < 0.9, `navy share ${navyShare().toFixed(2)}`);

    setMode("directions");
    await sleep(1200);
    check("directions mode draws white streaks", greyShare() > 0.05, `grey share ${greyShare().toFixed(3)}`);
    setMode("paint");
    await sleep(800);
    check("back to paint mode", greyShare() < 0.05 || navyShare() < 0.95, `grey ${greyShare().toFixed(3)}`);

    $("save").click();
    check("save image", await until(() => downloads.some((n) => /^starry-.*\.png$/.test(n)), 4000), downloads.join(","));

    const rec = $("record");
    check("record available", !rec.disabled);
    if (!rec.disabled) {
      rec.click();
      check("record clip", await until(() => downloads.some((n) => /^starry-.*\.(mp4|webm)$/.test(n)), 9000), downloads.join(","));
    }

    // Drop a photo onto the page.
    const blob = await (await fetch("starry-night.jpg")).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "dropped.jpg", { type: "image/jpeg" }));
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    check("drop a photo", await until(() => document.title === "Starry · dropped"));

    // Paste a photo.
    const pt = new DataTransfer();
    pt.items.add(new File([blob], "pasted.jpg", { type: "image/jpeg" }));
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: pt, bubbles: true }));
    check("paste a photo", await until(() => document.title === "Starry · Pasted image"));

    $("vangogh").click();
    check("back to Van Gogh", await until(() => document.title === "Starry · The Starry Night"));

    let opened = false;
    const file = $("file");
    const realFileClick = file.click;
    file.click = () => (opened = true);
    $("choose").click();
    file.click = realFileClick;
    check("choose photo opens the picker", opened);

    check("no horizontal scroll", document.documentElement.scrollWidth <= window.innerWidth);

    const c = canvas.getBoundingClientRect(), p = $("panel").getBoundingClientRect();
    check("card never covers the picture", c.right <= p.left || c.bottom <= p.top, JSON.stringify({ c, p }));

    // Phones only: the sheet collapses under its handle and comes back.
    const toggle = $("panel-toggle");
    if (toggle.offsetParent !== null) {
      toggle.click();
      await sleep(400);
      const c2 = canvas.getBoundingClientRect(), p2 = $("panel").getBoundingClientRect();
      check("collapse hides controls and keeps picture clear",
        $("panel").classList.contains("collapsed") && c2.bottom <= p2.top && toggle.getAttribute("aria-expanded") === "false");
      toggle.click();
      await sleep(300);
      check("expand brings controls back", !$("panel").classList.contains("collapsed") && $("particles").offsetParent !== null);
    }
  } finally {
    HTMLAnchorElement.prototype.click = realClick;
    // Put the defaults back for the next run.
    localStorage.removeItem("starry.settings");
  }
  return { pass: Object.values(checks).every((v) => v === true), checks };
}
