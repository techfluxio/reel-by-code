#!/usr/bin/env node
// storyboard.json -> MP4.  node engine/compose.mjs projects/example/storyboard.json [--size 1080] [--still 5.2] [--fresh]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, parseArgs, run, esc, firstExisting, dims, loadLook, loadStoryboard } from './lib.mjs';

const { _: [sbPath], flags } = parseArgs(process.argv.slice(2));
if (!sbPath) {
  console.error('usage: node engine/compose.mjs <storyboard.json> [--size 1080] [--out file.mp4] [--still seconds] [--fresh]');
  process.exit(2);
}

const sb = loadStoryboard(sbPath);
const look = loadLook(sb.look || 'documentary-paper');
const fps = sb.fps || 30;
const { W, H } = dims(sb.aspect || '9:16', Number(flags.size || sb.size || 1080));
const build = path.join(sb.dir, '.build');
const clipsDir = path.join(build, 'clips');
const textDir = path.join(build, 'text');
fs.mkdirSync(clipsDir, { recursive: true });
fs.mkdirSync(textDir, { recursive: true });
fs.mkdirSync(path.join(sb.dir, 'out'), { recursive: true });
const outFile = path.resolve(flags.out || path.join(sb.dir, 'out', `${sb.slug}.mp4`));

// ---- preflight -------------------------------------------------------------
const missing = sb.shots.filter((s) => !fs.existsSync(s.imageAbs));
if (missing.length) {
  console.error('Missing images:\n' + missing.map((s) => `  ${s.id}: ${s.image}`).join('\n'));
  console.error(`\nGenerate them (see \`node engine/prompts.mjs ${sbPath}\`) or make stand-ins with:\n  node engine/placeholder.mjs ${sbPath}`);
  process.exit(1);
}
const font = firstExisting(look.fonts);
if (!font) { console.error('No usable font found. See fonts/README.md'); process.exit(1); }
if (font.index > 1) console.warn(`! Using fallback font ${path.basename(font.abs)}. Add Anton or Oswald to fonts/ for the intended look.`);
const holeFont = firstExisting(look.holeFonts || []);

// ---- per-shot filter graph --------------------------------------------------
function cameraExpr(shot, N) {
  const amt = shot.camera_amount ?? look.camera.amount;
  const p = look.camera.ease === 'linear' ? `(on/${N})` : `(0.5-0.5*cos(PI*on/${N}))`;
  const cx = 'iw/2-(iw/zoom/2)', cy = 'ih/2-(ih/zoom/2)';
  switch (shot.camera) {
    case 'push-in':  return { z: `1+${amt}*${p}`, x: cx, y: cy };
    case 'pull-out': return { z: `1+${amt}*(1-${p})`, x: cx, y: cy };
    case 'pan-right': return { z: `${1 + amt}`, x: `(iw-iw/zoom)*${p}`, y: cy };
    case 'pan-left':  return { z: `${1 + amt}`, x: `(iw-iw/zoom)*(1-${p})`, y: cy };
    case 'drift':    return { z: `${1 + amt * 0.8}`, x: `(iw-iw/zoom)*(0.5+0.35*sin(2*PI*on/${N}*0.5))`, y: `(ih-ih/zoom)*(0.5-0.25*sin(2*PI*on/${N}*0.5))` };
    default:         return { z: '1', x: cx, y: cy };
  }
}

function captionFilters(shot) {
  const c = look.caption, out = [];
  const ink = shot.ink === 'light' ? look.colors.light : look.colors.dark;
  const x = Math.round(W * c.left);
  let y = Math.round(H * c.top);
  (shot.caption || []).forEach((raw, i) => {
    const line = String(raw).trim();
    const emph = /^\*.*\*$/.test(line);
    const text = (emph ? line.slice(1, -1) : line).toUpperCase();
    const size = Math.round(H * (emph ? c.emphasisSize : c.size));
    const file = path.join(textDir, `${shot.id}-cap${i}.txt`);
    fs.writeFileSync(file, text);
    const start = (shot.caption_at ?? c.delay) + i * c.stagger;
    const a = `min(1,max(0,(t-${start.toFixed(3)})/${c.fade}))`;
    out.push(
      `drawtext=fontfile='${esc(font.abs)}':textfile='${esc(file)}':expansion=none:fontsize=${size}` +
      `:fontcolor=${emph ? look.colors.accent : ink}:x=${x}:y='${y}+(1-${a})*${c.rise}':alpha='${a}'`
    );
    y += Math.round(size * c.lineHeight);
  });
  return out;
}

function paperFilters() {
  const out = [];
  if (look.crease) {
    const cx = Math.round(W * look.crease.x);
    out.push(`drawbox=x=${cx - 7}:y=0:w=14:h=ih:color=white@0.03:t=fill`);
    out.push(`drawbox=x=${cx - 3}:y=0:w=6:h=ih:color=white@0.05:t=fill`);
    out.push(`drawbox=x=${cx}:y=0:w=2:h=ih:color=black@0.14:t=fill`);
  }
  if (look.holes) {
    const h = look.holes, size = Math.round(H * h.size), x = Math.round(W * h.x);
    const holeTxt = path.join(textDir, 'hole.txt');
    fs.writeFileSync(holeTxt, '\u25CF');
    for (let k = 0; k < h.count; k++) {
      const y = Math.round((H * (k + 0.5)) / h.count);
      out.push(holeFont
        ? `drawtext=fontfile='${esc(holeFont.abs)}':textfile='${esc(holeTxt)}':fontsize=${size}:fontcolor=${h.color}:x=${x}:y=${y}`
        : `drawbox=x=${x}:y=${y}:w=${Math.round(size * 0.6)}:h=${Math.round(size * 0.6)}:color=${h.color}:t=fill`);
    }
  }
  return out;
}

function shotFilter(shot) {
  const S = 2, N = Math.max(1, Math.round(shot.duration * fps));
  const cam = cameraExpr(shot, N), g = look.grade;
  const f = [
    `scale=${S * W}:${S * H}:force_original_aspect_ratio=increase`,
    `crop=${S * W}:${S * H}`,
    'setsar=1',
    `zoompan=z='${cam.z}':x='${cam.x}':y='${cam.y}':d=${N}:s=${W}x${H}:fps=${fps}`,
    `eq=contrast=${g.contrast}:saturation=${g.saturation}:brightness=${g.brightness}`,
    `colorchannelmixer=rr=${(1 + g.warm).toFixed(3)}:bb=${(1 - g.warm).toFixed(3)}`,
    `vignette=angle=${look.vignette}`,
    ...captionFilters(shot),
    ...paperFilters(),
    `noise=alls=${look.grain}:allf=t+u`,
  ];
  if (shot.transition === 'fade') {
    f.push('fade=t=in:st=0:d=0.15', `fade=t=out:st=${Math.max(0, shot.duration - 0.15).toFixed(3)}:d=0.15`);
  }
  f.push('format=yuv420p');
  return f.join(',');
}

// ---- render clips (cached) --------------------------------------------------
console.log(`${sb.title || sb.slug}: ${sb.shots.length} shots, ${sb.total.toFixed(1)}s, ${W}x${H}@${fps}`);
const clips = [];
sb.shots.forEach((shot, i) => {
  const st = fs.statSync(shot.imageAbs);
  const key = crypto.createHash('sha1')
    .update(JSON.stringify({ shot, look, W, H, fps, st: [st.size, st.mtimeMs], font: font.abs, hf: holeFont?.abs }))
    .digest('hex').slice(0, 16);
  const clip = path.join(clipsDir, `${String(i + 1).padStart(2, '0')}-${shot.id}.mp4`);
  const stamp = clip + '.key';
  clips.push(clip);
  if (!flags.fresh && fs.existsSync(clip) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === key) {
    console.log(`  [${i + 1}/${sb.shots.length}] ${shot.id} (cached)`);
    return;
  }
  console.log(`  [${i + 1}/${sb.shots.length}] ${shot.id} ${shot.camera} ${shot.duration}s`);
  run('ffmpeg', ['-y', '-v', 'error', '-i', shot.imageAbs, '-vf', shotFilter(shot), '-t', String(shot.duration),
    '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', clip]);
  fs.writeFileSync(stamp, key);
});

// ---- concat -----------------------------------------------------------------
const list = path.join(build, 'clips.txt');
fs.writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n'));
const silent = path.join(build, 'video.mp4');
run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

// ---- audio ------------------------------------------------------------------
const inputs = [], chains = [], labels = [];
const au = sb.audio || {};
const want = (rel, what) => {
  if (!rel) return null;
  const p = path.resolve(sb.dir, rel);
  if (fs.existsSync(p)) return p;
  console.warn(`! ${what} not found, skipping: ${rel}`);
  return null;
};
const voice = want(au.voice, 'voice');
if (voice) {
  inputs.push(voice);
  const ms = Math.round((au.voice_at || 0) * 1000);
  chains.push(`[${inputs.length}:a]adelay=${ms}|${ms},volume=${au.voice_volume ?? 1}[a${inputs.length}]`);
  labels.push(`[a${inputs.length}]`);
}
const music = want(au.music, 'music');
if (music) {
  inputs.push(music);
  const fo = au.fade_out ?? 1.5;
  chains.push(`[${inputs.length}:a]atrim=0:${sb.total},asetpts=PTS-STARTPTS,volume=${au.music_volume ?? 0.2},` +
    `afade=t=out:st=${Math.max(0, sb.total - fo).toFixed(2)}:d=${fo}[a${inputs.length}]`);
  labels.push(`[a${inputs.length}]`);
}
let t0 = 0;
for (const shot of sb.shots) {
  for (const s of shot.sfx || []) {
    const p = want(s.file, `sfx (${shot.id})`);
    if (p) {
      inputs.push(p);
      const ms = Math.round((t0 + (s.at || 0)) * 1000);
      chains.push(`[${inputs.length}:a]adelay=${ms}|${ms},volume=${s.volume ?? 0.8}[a${inputs.length}]`);
      labels.push(`[a${inputs.length}]`);
    }
  }
  t0 += shot.duration;
}

if (!labels.length) {
  fs.copyFileSync(silent, outFile);
} else {
  const n = labels.length;
  const fc = [...chains, `${labels.join('')}amix=inputs=${n}:duration=longest:dropout_transition=0,volume=${n},alimiter=limit=0.95[aout]`].join(';');
  const args = ['-y', '-v', 'error', '-i', silent];
  inputs.forEach((p) => args.push('-i', p));
  args.push('-filter_complex', fc, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(sb.total), outFile);
  run('ffmpeg', args);
}
console.log(`-> ${path.relative(ROOT, outFile)}`);

if (flags.still) {
  const png = path.join(build, `still-${flags.still}.png`);
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(flags.still), '-i', outFile, '-frames:v', '1', png]);
  console.log(`still -> ${path.relative(ROOT, png)}`);
}
