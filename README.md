# reel-by-code

Vertical captioned reels, finished in code. You bring the images (and optionally voice, music and sound effects); a **storyboard** describes the film; Node + ffmpeg turn it into an MP4 with slow camera moves, animated headline captions, a paper look (grain, vignette, fold crease, punch holes) and a mixed soundtrack.

It is the sibling of [drawn-by-code](https://github.com/illodev/drawn-by-code): that repo *draws* every frame in code; this one *finishes* photographic or AI-generated stills in code. Use this when the pictures are photoreal and the craft is in the camera, captions, grade and timing.

```
storyboard.json ─▶ prompts.mjs ─▶ (you make the images) ─▶ compose.mjs ─▶ review.mjs ─▶ fix
```

## Requirements

Node 20+ and ffmpeg 6+ (with `drawtext`, i.e. built with libfreetype). No npm dependencies.

## Quick start

```bash
node engine/placeholder.mjs projects/example/storyboard.json      # stand-in images, to test timing/captions
node engine/compose.mjs     projects/example/storyboard.json --size 540 --still 4.5
node engine/review.mjs      projects/example/storyboard.json      # checks + contact sheet
```

Real project:

```bash
cp -r projects/example projects/my-reel          # then edit storyboard.json
node engine/prompts.mjs projects/my-reel/storyboard.json     # writes prompts.md, one prompt per shot
# generate the images, save them where prompts.md says (9:16), then:
node engine/compose.mjs projects/my-reel/storyboard.json     # 1080x1920 MP4 in projects/my-reel/out/
```

Per-shot clips are cached in `.build/`, so changing one caption re-renders one shot. `--fresh` ignores the cache.

## Storyboard

```jsonc
{
  "title": "My Reel", "aspect": "9:16", "fps": 30, "look": "documentary-paper",
  "style_bible": "photorealistic documentary still, warm amber light ...",   // appended to every image prompt
  "audio": { "voice": "audio/voice.mp3", "voice_at": 0.3, "music": "audio/music.mp3", "music_volume": 0.18, "fade_out": 1.5 },
  "shots": [{
    "id": "02-tea-hand", "image": "shots/02-tea-hand.jpg", "duration": 3.4,
    "camera": "drift",                 // push-in | pull-out | pan-left | pan-right | drift | static
    "ink": "dark",                     // caption colour: dark | light (pick per image)
    "caption": ["YOU MAY FEEL", "*PERFECTLY FINE*"],   // *wrapped* line = big accent-colour line
    "transition": "cut",               // cut (default) | fade (dip to black)
    "sfx": [{ "file": "audio/whoosh.wav", "at": 0.0, "volume": 0.7 }],
    "prompt": "close-up of a hand holding a glass of tea ..."
  }]
}
```

Paths are relative to the storyboard. Missing audio files are skipped with a warning.

## What `review.mjs` checks

Duration vs storyboard, black frames, frozen picture (camera moves too small), caption overflow (estimate), caption **contrast** against the actual image (dark ink on a dark photo), shots too short/long, audio clipping/quietness, and it writes a contact sheet (`.build/review/contact.jpg`). It cannot judge taste: always look at the sheet.

## Looks

A look is a JSON file in `looks/` (grade, vignette, grain, camera amount, caption sizes/colours, crease, punch holes, font list). `documentary-paper` is included. Copy it to make `newsprint`, `vhs`, `blueprint`... Add a bold condensed font (Anton / Oswald, see `fonts/README.md`) for the intended headline look.

## Limits

- The images themselves are not generated here. Prompts are, images are yours (any image model, stock, or photos).
- Captions are line-level (a whole line is normal or accent); no per-word colour inside one line yet.
- ffmpeg-only compositing: no per-pixel halftone, torn-paper edges or hand animation. For those, render the shots with drawn-by-code and feed the frames/clips in.
- Windows paths inside filters are escaped but untested.

## Ideas for contributions

New looks, per-word emphasis, burned-in subtitles from a transcript (whisper), beat-synced cuts from `music`, ducking music under voice, a `--vertical-safe` overlay for platform UI.

MIT licensed.
