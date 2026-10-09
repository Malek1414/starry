# Starry

Turn any photo into Van Gogh-style flowing brushwork, right in the browser.

**Live:** https://malek1414.github.io/starry/ (works on phone, tablet and desktop, and can be installed to the home screen)

Starry reads the direction of the brushwork in a picture: its edges, contours and swirls.
Then thousands of particles flow along those directions, each painting a short
stroke in the colour underneath it. It opens on *The Starry Night*. Pick your
own photo and it gets painted the same way.

Inspired by [@gazisj's Kotlin Starry Night app](https://www.instagram.com/p/DeP2tbxBoEe/).

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
| Directions | Show the direction field alone: white streaks on navy |
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

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: field, particles, colour
npm run build    # type-check + production build → dist/
```

Every push to `main` is tested, built and deployed to GitHub Pages by
`.github/workflows/pages.yml`.

The plan this was built from is in [`docs/PLAN.md`](docs/PLAN.md).
*The Starry Night* (1889) is in the public domain; the bundled copy is from Wikimedia Commons.
