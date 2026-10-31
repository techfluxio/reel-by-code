---
name: reel
description: Make a vertical captioned reel (hook, beats, punchy captions over camera-move stills) with this repo. Use for any request like "make a short video / reel / explainer from these images", from brief to final MP4.
---

# reel: brief -> MP4

## Process
1. **Brief**: topic, audience, length (default 20-40 s), voiceover yes/no, look (default `documentary-paper`). Ask only what is missing.
2. **Script in beats**: one idea per shot. Pattern that works: *calm setup -> "you may feel fine" turn -> the cost -> the action*. Last shot is the instruction or the punch.
3. **Storyboard** (`projects/<name>/storyboard.json`): one shot per beat. Copy `projects/example/`.
4. **Prompts**: fill `style_bible` once (light, palette, grain, lens) and a short `prompt` per shot; run `engine/prompts.mjs`. Hand the prompts to the person (this environment cannot generate images). Until the images exist, use `engine/placeholder.mjs`.
5. **Compose + review** at `--size 540`. Look at the contact sheet and stills. Fix, repeat (max 3 rounds). Then full size.
6. **Audio** last: voice first, music under it (0.15-0.2), sfx on the cut frames.

## Rules of good reels
- Shots 2-4 s; never under 1.5 s or over 6 s. Vary camera: no more than two same moves in a row.
- Captions: 1-3 lines, 1-3 words per line, ALL CAPS is applied by the engine. One accent line (`*wrapped*`) per shot at most: it is the word the viewer must remember.
- Caption area is top-left, top third of the frame: ask for images with a calm top third (sky, wall, blur).
- `ink` follows the image: `dark` on bright tops, `light` on dark ones. `review.mjs` checks the contrast.
- Pan moves need width: ask for a wide subject with room left and right.
- One style bible for every image, same light direction and palette, or the film falls apart.
- Hook in the first 2 seconds; end on a hard cut or a `fade` dip, not on a fade-to-nothing.
- Keep the person's own wording for captions; do not invent facts. Health, safety and news content must be accurate: say what to verify.

## Pitfalls
- Fallback font in use: warn the person to add Anton/Oswald to `fonts/`.
- Caption overflow estimate is approximate; confirm in a still.
- Missing audio files are skipped silently apart from a warning: check the log.
