# Starry — design pass

Applies the McCODZ design philosophy (`mccodz-vscode/.github/skills/design-philosophy`):
name the **feeling**, find the **principle** it breaks, then make the **move**.
Functions are frozen: every control keeps its id and behaviour, checked by
`tests/smoke.browser.js` before and after.

## Audit of v0.1

| # | See | Feeling | Principle broken | Move |
|---|-----|---------|------------------|------|
| 1 | On a laptop the control card sits on top of the painting's corner | not *Focused* | 4 · One thing leads: chrome competes with the artwork | Give the card its own column on wide screens and a docked sheet below the picture on tablets and phones. The picture is never covered |
| 2 | The full card stays bright while you just watch the painting | not *Calm* | 1 · Quiet at rest, present on intent | On pointer devices the card dims after a few idle seconds and comes back on hover, focus or any movement |
| 3 | Six buttons in two rows, three equally loud yellow ones | not *Focused* | 4 · One thing leads | One primary action (**Choose photo**, filled). **Save image** and **Record clip** are quiet secondary controls, and **Restart** and **Back to Van Gogh** are plain text |
| 4 | The "Directions" button changes its label to "Paint" when pressed, so it shows the mode you're *not* in | not *Calm* | 3 · The interface explains itself | A two-way switch, **Paint · Directions**, that shows the current mode |
| 5 | Nothing says what the app is | not *Calm* | 3 · Explains itself | A quiet header: the name and a one-line description |
| 6 | Card radius 14, sheet 16, canvas 6, drop zone 12, buttons 8 | not *Consistent* | 5 · Elevation is encoded | Outer surfaces (card, sheet, drop zone, artwork) use the outer tier (8), controls the control tier (4), and the switch and status use full pills |
| 7 | Spacing 14 / 10 / 6 / 22 px | not *Consistent* | 2 · Room to breathe + 6 · Sameness | Every gap moves onto the 4-px ramp (4, 8, 12, 16, 24) |
| 8 | Font sizes 13, 14 and 18 at weights 500 and 600 | not *Consistent* | 6 · Sameness | Type ramp roles only (heading2 18, body1 13, label1 12) at regular and semiBold, with no 500 |
| 9 | Save or record finishes and nothing confirms it | not *Delightful* | 7 · Delight earns its keep | A short "Saved" / "Clip saved" status pill confirms it, then fades |
| 10 | Transitions ignore reduced-motion settings | not *Calm* | 1 | `prefers-reduced-motion` turns off fades |
