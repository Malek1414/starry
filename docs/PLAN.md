# Starry — implementation plan (v1)

Goal: a web app that does what gazisj's Kotlin "Starry Night" app does
(reel DeP2tbxBoEe), for any photo, on any screen.

## What her app does (from the video)
- Opens on Van Gogh's *Starry Night*. Thousands of particles flow along a
  direction field read from the painting ("those swirls are a map of
  directions") and paint short coloured strokes, so the picture re-paints
  itself as moving brushwork.
- A field view: white streaks on navy showing the directions alone.
- Control panel (navy card, yellow/blue sliders):
  - **Particles** (4,000 → ~10,000)
  - **Stroke length** (px, 2.5 → ~7)
  - **Color sharpness** (%)
  - **Order** (%) — 100 % follows the field exactly, lower adds chaos
  - Buttons: **Choose photo**, **Save image**, **Restart**, plus **Back to Van Gogh**
- Same app on desktop, phone and tablet.

## Our version
Static web app (Vite + TypeScript, no framework), installable as a PWA,
deployed to GitHub Pages from the `Malek1414/starry` repo. Everything runs in
the browser; photos never leave the device.

### Algorithm (`src/core/`, pure functions, unit-tested)
1. `image.ts` — downscale the photo to a working grid (long side ≤ 720 px),
   luminance, separable Gaussian blur.
2. `field.ts` — Sobel gradients → structure tensor (Jxx, Jxy, Jyy) smoothed
   by a Gaussian (σ ≈ 1.5 % of the long side) → edge-tangent orientation
   θ = ½·atan2(2Jxy, Jxx−Jyy) + π/2 and coherence. Stored as (cos2θ, sin2θ)
   so bilinear sampling interpolates orientation correctly.
   Where coherence is low (flat sky, walls), blend in a curl-noise swirl so
   empty areas still turn into Van Gogh-style eddies.
3. `particles.ts` — struct-of-arrays particle system (Float32Array).
   Step: sample orientation, pick the sign that agrees with the particle's
   previous heading (orientation is ±), mix with a random heading by
   (1 − Order), move by Stroke length, age, respawn when out of bounds or old.
4. `color.ts` — stroke colour = mix(blurred colour, sharp pixel colour,
   Color sharpness), slight saturation lift.

### Rendering (`src/render.ts`)
- Canvas 2D at display size × devicePixelRatio (capped at 2048 px long side).
- Background deep navy. Each frame draws every particle's segment; strokes
  accumulate so the painting builds up, with a tiny fade so it keeps moving.
- **Directions** mode draws white strokes instead of image colours.
- Draw calls batched by quantised colour (path per colour bucket) so
  10,000 particles stay at 60 fps on a laptop and ~30 on a phone.

### UI (`index.html`, `src/main.ts`, `src/style.css`)
- Full-bleed canvas; floating control card like hers (collapsible on phone).
- Sliders: Particles, Stroke length, Color sharpness, Order.
- Buttons: Choose photo (file input, also accepts drag-drop and paste),
  Save image (PNG; Web Share on phones), Restart, Back to Van Gogh,
  Directions/Paint toggle, Record (6 s WebM/MP4 clip via MediaRecorder for
  reels).
- Default image: *The Starry Night* (public domain, Wikimedia Commons), bundled.

### PWA + deploy
- `manifest.webmanifest`, icons, a small service worker (cache app shell).
- GitHub Actions: `npm ci && npm test && npm run build` → Pages.

### Verification
- Vitest: field orientation on synthetic stripes/rings, sampling, particle
  bounds/respawn, colour mixing.
- `tsc --noEmit`, `vite build`.
- Real browser: load the app, check default painting renders, upload a
  photo, move sliders, save a PNG, check the console is clean, check at
  phone width.

## Review → revisions (v2)
1. **Fade would darken the painting.** At 4,000 short strokes per frame a
   constant fade outruns the paint and the image goes dim. Paint mode now
   accumulates with no fade (the picture builds up, as in her video).
   Only Directions mode fades (0.05 per frame), so its streaks move.
2. **Per-particle `stroke()` is too slow** (10k calls ≈ 30 ms/frame). Batch
   by colour quantised to 4 bits per channel (≤ 4,096 paths, far fewer in
   practice); the alpha build-up hides the banding.
3. **Units.** Particles live in field-grid coordinates; Stroke length is in
   screen px, so the step is converted per frame with the grid→canvas scale.
   Otherwise slider values would mean different things on phone and laptop.
4. **Orientation sign flips.** Store a heading per particle and flip the
   sampled tangent when dot(prev, new) < 0; without this, strokes jitter
   back and forth along edges.
5. **Photos from phones.** `createImageBitmap(file)` respects EXIF rotation;
   iOS converts HEIC to JPEG for `<input accept="image/*">`. Downscale before
   analysis so a 48 MP photo doesn't stall the tab.
6. **Pages hosting.** Vite `base: "./"` (works at any path); service worker caches
   network-first for HTML and cache-first for hashed `/assets/`, so deploys
   are picked up immediately.
7. **Restart** clears to navy and respawns particles; changing Particles
   resizes the arrays in place without clearing; a new photo rebuilds the field.
8. Field quality check: Starry Night must show its big central swirl and
   the circular halos round the stars. If the structure tensor is too local,
   raise σ. This is checked visually in the browser, not only in unit tests.
