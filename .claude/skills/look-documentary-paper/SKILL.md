---
name: look-documentary-paper
description: The documentary-paper look: warm grade, vignette, film grain, a vertical fold crease, punch holes down the left edge, bold condensed captions with one red emphasis line. Use when tuning or extending looks/documentary-paper.json.
---

# documentary-paper

Made of: warm colour grade (`grade.warm`), `vignette`, temporal `grain`, a faint **fold crease** at `crease.x` (0.63 of the width), a column of **punch holes** at the left edge, and top-left captions (normal line in `ink`, emphasis line in `colors.accent`).

## Tuning
- Too clean: raise `grain` (9 -> 14). Too dirty: lower it; above ~16 it eats the captions.
- Captions too big: `caption.size` / `emphasisSize` are fractions of the frame height (0.034 / 0.048).
- Camera too lively: `camera.amount` 0.10 -> 0.06. A shot can override with `camera_amount`.
- Crease and holes should be felt, not seen: keep alphas low (`holes.color` alpha <= 0.4).

## Making a new look
Copy the JSON, change `name`, grade, colours, fonts. A look only sets numbers; new effects (halftone, scratches, light leaks) go in `engine/compose.mjs` behind a look key, and the look that uses them documents it here.
