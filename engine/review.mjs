#!/usr/bin/env node
// Automatic critique of a rendered reel: duration, black frames, freezes, audio levels, caption fit, contact sheet.
// node engine/review.mjs projects/example/storyboard.json [video.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, run, probeSize, loadLook, loadStoryboard, probeDuration, hasAudio } from './lib.mjs';

const { _: [sbPath, videoArg] } = parseArgs(process.argv.slice(2));
if (!sbPath) { console.error('usage: node engine/review.mjs <storyboard.json> [video.mp4]'); process.exit(2); }
const sb = loadStoryboard(sbPath);
const look = loadLook(sb.look || 'documentary-paper');
const video = path.resolve(videoArg || path.join(sb.dir, 'out', `${sb.slug}.mp4`));
if (!fs.existsSync(video)) { console.error(`No render at ${video}. Run compose first.`); process.exit(1); }

const warns = [], notes = [];

const { W, H } = probeSize(video);

// 1. duration
const dur = probeDuration(video);
if (Math.abs(dur - sb.total) > 0.25) warns.push(`duration ${dur.toFixed(2)}s differs from storyboard ${sb.total.toFixed(2)}s`);
else notes.push(`duration ${dur.toFixed(2)}s matches storyboard`);

// shot time ranges
let t = 0;
const ranges = sb.shots.map((s) => { const r = { s, a: t, b: t + s.duration }; t += s.duration; return r; });
const shotAt = (x) => ranges.find((r) => x >= r.a - 0.05 && x < r.b + 0.05)?.s.id ?? '?';

// 2. black frames (ignore the ones at deliberate fade transitions)
const bl = run('ffmpeg', ['-v', 'info', '-i', video, '-vf', 'blackdetect=d=0.12:pix_th=0.10', '-an', '-f', 'null', '-'], { allowFail: true }).stderr;
for (const m of bl.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) {
  const a = +m[1], id = shotAt(a), shot = sb.shots.find((s) => s.id === id);
  if (shot?.transition === 'fade' || a < 0.05) continue;
  warns.push(`black frames ${m[1]}s-${m[2]}s (shot ${id}): is the image too dark or missing?`);
}

// 3. freezes (camera moves should keep pixels changing)
const fz = run('ffmpeg', ['-v', 'info', '-i', video, '-vf', 'freezedetect=n=0.0005:d=0.7', '-an', '-f', 'null', '-'], { allowFail: true }).stderr;
for (const m of fz.matchAll(/freeze_start: ([\d.]+)/g)) {
  const id = shotAt(+m[1]), shot = sb.shots.find((s) => s.id === id);
  if (shot?.camera === 'static') continue;
  warns.push(`frozen picture from ${(+m[1]).toFixed(1)}s (shot ${id}, camera ${shot?.camera}): camera motion may be too small`);
}

// 4. caption fit (estimate: ~0.6 em per character for a condensed bold face)
for (const s of sb.shots) {
  (s.caption || []).forEach((raw) => {
    const emph = /^\*.*\*$/.test(raw.trim());
    const text = emph ? raw.trim().slice(1, -1) : raw.trim();
    const size = H * (emph ? look.caption.emphasisSize : look.caption.size);
    const est = text.length * size * 0.6, room = W * (1 - look.caption.left - 0.05);
    if (est > room) warns.push(`shot ${s.id}: caption "${text}" may overflow (est ${Math.round(est)}px > ${Math.round(room)}px); shorten or split`);
  });
  if (s.duration < 1.5) warns.push(`shot ${s.id}: ${s.duration}s is very short for captions to read`);
  if (s.duration > 6) warns.push(`shot ${s.id}: ${s.duration}s is long; add a cut or a second camera move`);
}

// 5. audio
if (!hasAudio(video)) notes.push('no audio track (storyboard has no audio or files were missing)');
else {
  const vd = run('ffmpeg', ['-v', 'info', '-i', video, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { allowFail: true }).stderr;
  const mean = parseFloat(vd.match(/mean_volume: (-?[\d.]+)/)?.[1]);
  const max = parseFloat(vd.match(/max_volume: (-?[\d.]+)/)?.[1]);
  if (max > -0.5) warns.push(`audio peaks at ${max} dB: likely clipping`);
  if (mean < -30) warns.push(`audio mean ${mean} dB is very quiet`);
  notes.push(`audio mean ${mean} dB, peak ${max} dB`);
}

// 5b. caption contrast: brightness of the caption area vs the ink colour chosen for the shot
ranges.forEach((r) => {
  if (!(r.s.caption || []).length) return;
  const at = Math.min(dur - 0.05, r.a + Math.min(1.2, r.s.duration * 0.6));
  const c = look.caption;
  const box = `crop=${Math.round(W * 0.6)}:${Math.round(H * 0.16)}:${Math.round(W * c.left)}:${Math.round(H * c.top)}`;
  const o = run('ffmpeg', ['-v', 'error', '-ss', at.toFixed(2), '-i', video, '-frames:v', '1', '-vf', `${box},signalstats,metadata=print:file=-`, '-f', 'null', '-'], { allowFail: true }).stdout;
  const y = parseFloat(o.match(/YAVG=([0-9.]+)/)?.[1]);
  if (Number.isNaN(y)) return;
  const light = r.s.ink === 'light';
  if (!light && y < 95) warns.push(`shot ${r.s.id}: dark ink on a dark area (brightness ${Math.round(y)}/255); set "ink": "light" or use a brighter top of frame`);
  if (light && y > 160) warns.push(`shot ${r.s.id}: light ink on a bright area (brightness ${Math.round(y)}/255); set "ink": "dark"`);
});

// 6. contact sheet: one frame per shot at 60% through
const dir = path.join(sb.dir, '.build', 'review');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
ranges.forEach((r, i) => {
  const at = Math.min(dur - 0.05, r.a + (r.b - r.a) * 0.6);
  run('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=270:-1', path.join(dir, `${String(i + 1).padStart(2, '0')}.jpg`)]);
});
const cols = Math.min(6, sb.shots.length), rows = Math.ceil(sb.shots.length / cols);
const sheet = path.join(dir, 'contact.jpg');
run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, '%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=6:color=black`, '-frames:v', '1', sheet]);

console.log(notes.map((n) => `  ok    ${n}`).join('\n'));
console.log(warns.length ? warns.map((w) => `  WARN  ${w}`).join('\n') : '  PASS  no issues found');
console.log(`contact sheet -> ${path.relative(ROOT, sheet)}  (look at it: the checks cannot judge taste)`);
process.exit(warns.length ? 1 : 0);
