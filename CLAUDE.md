# reel-by-code

Storyboard-driven captioned reels: stills + captions + camera moves + sound -> MP4, all with Node + ffmpeg.
Repo, code, docs and commits are in English; the conversation may be in any language. On-screen caption text is creative content and stays in whatever language the video needs.

## Map

| Path | What |
|---|---|
| `.claude/skills/reel/` | **Start here**: the process from brief to MP4 and the rules of good reels |
| `.claude/skills/look-documentary-paper/` | Rules for the paper/grain look |
| `engine/compose.mjs` | storyboard -> MP4 (cached per shot) |
| `engine/prompts.mjs` | storyboard -> `prompts.md` for image generation |
| `engine/placeholder.mjs` | stand-in images for testing |
| `engine/review.mjs` | automatic checks + contact sheet |
| `looks/*.json` | looks (grade, caption, paper effects, fonts) |
| `projects/<name>/` | one reel per folder: `storyboard.json`, `shots/`, `audio/`, `out/` |

## Commands

```bash
node engine/prompts.mjs projects/<p>/storyboard.json
node engine/placeholder.mjs projects/<p>/storyboard.json
node engine/compose.mjs projects/<p>/storyboard.json [--size 540] [--still 4.5] [--fresh]
node engine/review.mjs projects/<p>/storyboard.json
```

## The loop (mandatory)

1. Write/edit the storyboard. 2. Render at `--size 540` for speed. 3. Run `review.mjs`. 4. **Look at the contact sheet and at stills** (`--still`); do not trust PASS alone. 5. Fix, at most 3 rounds, then render at full size. 6. A lesson that generalizes goes into a skill.
Never claim a reel is done without having looked at real frames.
