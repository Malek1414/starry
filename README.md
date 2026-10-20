<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/banner-dark.svg">
  <img alt="Starry: a pixel star with a face, blinking inside a spinning swirl of blue brushstrokes" src="assets/readme/banner-light.svg" width="100%">
</picture>
</p>

<p align="center">
  <a href="https://malek1414.github.io/starry/"><b>Live</b></a> &nbsp;·&nbsp;
  <a href="docs/PLAN.md"><b>Plan</b></a> &nbsp;·&nbsp;
  <a href="docs/DESIGN.md"><b>Design pass</b></a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-7-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white">
  <img alt="Canvas 2D" src="https://img.shields.io/badge/render-Canvas_2D-e8a317?style=flat-square">
  <img alt="Vitest" src="https://img.shields.io/badge/tests-Vitest-6e9f18?style=flat-square&logo=vitest&logoColor=white">
  <img alt="Installable web app" src="https://img.shields.io/badge/PWA-phone_·_tablet_·_desktop-4f7cff?style=flat-square">
</p>

**Turn any photo into Van Gogh-style flowing brushwork, right in the browser.** Starry reads the direction of the brushwork in a picture: its edges, contours and swirls. Then thousands of particles flow along those directions, each painting a short stroke in the colour underneath it.

It opens on *The Starry Night*. Pick your own photo and it gets painted the same way. It works on phone, tablet and desktop, and can be installed to the home screen: **https://malek1414.github.io/starry/**

Inspired by [@gazisj's Kotlin Starry Night app](https://www.instagram.com/p/DeP2tbxBoEe/).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

## Controls

| Control | What it does |
| --- | --- |
| Particles | How many brushes are painting at once (500–20,000) |
| Stroke length | How far each brush moves per frame, in px; also sets the brush width |
| Color sharpness | 100 % uses the exact pixel colour, lower blends in the surrounding colour |
| Order | 100 % follows the picture's directions exactly; lower adds chaos |
| Choose photo | Paint your own picture (or drag and drop / paste one) |
| Save image | PNG download; on a phone, opens the share sheet so you can save to Photos |
| Restart | Clear the canvas and paint again from scratch |
| Paint · Directions | Switch between the painting and the direction field alone (white streaks on navy) |
| Record clip | A 6-second video of the painting appearing (MP4 or WebM) |
| Back to Van Gogh | Load *The Starry Night* again |

Your photos never leave your device. Everything runs locally in the page.

## How it works

1. **Direction field** (`src/core/field.ts`): Sobel gradients → a smoothed
   structure tensor → the edge-tangent orientation and how coherent it is at
   each point. Orientation is stored as (cos 2θ, sin 2θ) so it interpolates
   cleanly. In flat areas (sky, walls) a smooth noise field takes over, so
   they turn into eddies instead of standing still.
2. **Particles** (`src/core/particles.ts`): a struct-of-arrays system that
   steps along the field and keeps its heading (a direction field has no
   arrow, so each particle picks the sign that agrees with where it was going).
3. **Colour** (`src/core/color.ts`): blends the sharp and softened colour by
   *Color sharpness*, lifts saturation a little, and gives each particle its
   own brightness so neighbouring strokes read as separate dabs.
4. **Rendering** (`src/engine.ts`): Canvas 2D. Strokes are grouped by
   quantised colour (counting sort), so each frame is a few hundred `stroke()`
   calls rather than one per particle. That keeps it at 60 fps with 20,000 particles.

A small service worker (`public/sw.js`) makes it work offline: pages load network-first so a new deploy shows up right away, and everything else (hashed assets, the painting, icons) is served cache-first.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

## Develop

You need Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: field, particles, colour
npm run build    # type-check + production build → dist/
```

Every push to `main` is tested, built and deployed to GitHub Pages by
`.github/workflows/pages.yml`.

`tests/smoke.browser.js` drives every control in a real browser and is run
before and after any visual change.

## Structure

```
src/
  main.ts            controls, photo input, save and record
  engine.ts          animation loop and Canvas 2D stroke batching
  core/field.ts      Sobel gradients, structure tensor, direction field
  core/particles.ts  struct-of-arrays particle system
  core/color.ts      stroke colour, saturation and per-particle brightness
  core/image.ts      float RGB working image
  core/noise.ts      seeded value noise for flat areas
public/              manifest, service worker, icons, The Starry Night
tests/               vitest unit tests and the browser smoke test
docs/                PLAN.md and DESIGN.md
```

The plan this was built from is in [`docs/PLAN.md`](docs/PLAN.md); the design pass
(McCODZ Values → Principles → Moves) is in [`docs/DESIGN.md`](docs/DESIGN.md).

*The Starry Night* (1889) is in the public domain; the bundled copy is from Wikimedia Commons.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

<p align="center">
  <img alt="" src="assets/readme/logo.svg" width="72"><br>
  <sub>Built by <a href="https://github.com/Malek1414">Malek Hassan</a> in Berlin.</sub>
</p>
