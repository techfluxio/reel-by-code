#!/usr/bin/env node
// Makes stand-in images for shots whose image file does not exist yet, so you can test timing and captions.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, run, esc, firstExisting, dims, loadLook, loadStoryboard } from './lib.mjs';

const { _: [sbPath], flags } = parseArgs(process.argv.slice(2));
if (!sbPath) { console.error('usage: node engine/placeholder.mjs <storyboard.json> [--force]'); process.exit(2); }
const sb = loadStoryboard(sbPath);
const look = loadLook(sb.look || 'documentary-paper');
const font = firstExisting(look.fonts);
const { W, H } = dims(sb.aspect || '9:16', 1080);
const palette = ['e8c98f', 'e3b872', 'c3cdb9', 'f0e1bd', '9fb0c4', '6b6a64', 'd6b88a', 'f3e8cf'];
const tmp = path.join(sb.dir, '.build', 'text');
fs.mkdirSync(tmp, { recursive: true });

sb.shots.forEach((s, i) => {
  if (fs.existsSync(s.imageAbs) && !flags.force) return;
  fs.mkdirSync(path.dirname(s.imageAbs), { recursive: true });
  const label = path.join(tmp, `ph-${s.id}.txt`);
  fs.writeFileSync(label, `${s.id}\nPLACEHOLDER`);
  const bw = Math.round(W * 0.34), bh = Math.round(H * 0.5);
  const vf = [
    `drawbox=x=${Math.round(W * 0.5 - bw / 2)}:y=${Math.round(H * 0.34)}:w=${bw}:h=${bh}:color=white@0.35:t=fill`,
    `drawbox=x=0:y=${Math.round(H * 0.84)}:w=${W}:h=${Math.round(H * 0.16)}:color=black@0.25:t=fill`,
    font ? `drawtext=fontfile='${esc(font.abs)}':textfile='${esc(label)}':expansion=none:fontsize=${Math.round(H * 0.025)}:fontcolor=white@0.8:x=(w-text_w)/2:y=${Math.round(H * 0.9)}` : 'null',
    'vignette=angle=PI/8',
  ].join(',');
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x${palette[i % palette.length]}:s=${W}x${H}:d=0.04`, '-vf', vf, '-frames:v', '1', '-q:v', '3', s.imageAbs]);
  console.log(`placeholder: ${path.relative(process.cwd(), s.imageAbs)}`);
});
