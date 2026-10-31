import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const _ = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) flags[k] = true;
      else { flags[k] = n; i++; }
    } else _.push(a);
  }
  return { _, flags };
}

export function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message} (is it installed?)`);
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} failed:\n${(r.stderr || '').split('\n').slice(-25).join('\n')}`);
  }
  return r;
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/** Escape a filesystem path for use inside an ffmpeg filter argument. */
export const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, '');

export function firstExisting(list) {
  for (const p of list) {
    const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (fs.existsSync(abs)) return { abs, index: list.indexOf(p) };
  }
  return null;
}

export function dims(aspect = '9:16', width = 1080) {
  const [a, b] = aspect.split(':').map(Number);
  return { W: Math.round(width / 2) * 2, H: Math.round((width * b) / a / 2) * 2 };
}

export function loadLook(name) {
  const f = path.join(ROOT, 'looks', `${name}.json`);
  if (!fs.existsSync(f)) throw new Error(`Unknown look "${name}" (no looks/${name}.json)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const CAMERAS = ['push-in', 'pull-out', 'pan-left', 'pan-right', 'drift', 'static'];

export function loadStoryboard(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`Storyboard not found: ${file}`);
  const sb = JSON.parse(fs.readFileSync(abs, 'utf8'));
  sb.file = abs;
  sb.dir = path.dirname(abs);
  if (!Array.isArray(sb.shots) || !sb.shots.length) throw new Error('storyboard.shots must be a non-empty array');
  const ids = new Set();
  sb.shots.forEach((s, i) => {
    s.id = slug(s.id || `shot${i + 1}`);
    if (ids.has(s.id)) throw new Error(`Duplicate shot id "${s.id}"`);
    ids.add(s.id);
    if (!(s.duration > 0)) throw new Error(`Shot ${s.id}: duration must be > 0`);
    s.camera = s.camera || 'push-in';
    if (!CAMERAS.includes(s.camera)) throw new Error(`Shot ${s.id}: camera must be one of ${CAMERAS.join(', ')}`);
    if (!s.image) throw new Error(`Shot ${s.id}: missing "image"`);
    s.imageAbs = path.resolve(sb.dir, s.image);
  });
  sb.total = sb.shots.reduce((t, s) => t + s.duration, 0);
  sb.slug = slug(sb.title || path.basename(sb.dir));
  return sb;
}

export function probeDuration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(r.stdout);
}

export function hasAudio(file) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file]);
  return r.stdout.trim().length > 0;
}

export function probeSize(file) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]);
  const [W, H] = r.stdout.trim().split('x').map(Number);
  return { W, H };
}
