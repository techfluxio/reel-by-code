#!/usr/bin/env node
// Writes prompts.md: one image-generation prompt per shot, all sharing the storyboard's style bible
// so the images look like they belong to one film.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, loadStoryboard } from './lib.mjs';

const { _: [sbPath] } = parseArgs(process.argv.slice(2));
if (!sbPath) { console.error('usage: node engine/prompts.mjs <storyboard.json>'); process.exit(2); }
const sb = loadStoryboard(sbPath);
const bible = sb.style_bible || '';
const aspect = sb.aspect || '9:16';
const lines = [`# Image prompts: ${sb.title || sb.slug}`, '', `Aspect ratio **${aspect}** (vertical). Save each image at the path shown.`, ''];
if (bible) lines.push('**Style bible** (appended to every prompt):', '', `> ${bible}`, '');
sb.shots.forEach((s, i) => {
  lines.push(`## ${i + 1}. ${s.id}  (${s.duration}s, ${s.camera})`, '',
    `Save as: \`${s.image}\``, '',
    `\`\`\`\n${[s.prompt || '(add a "prompt" to this shot)', bible, `${aspect} vertical, no text, no watermark, no logos`].filter(Boolean).join(', ')}\n\`\`\``, '');
  if (s.camera.startsWith('pan')) lines.push('_Pan shot: leave extra room left and right of the subject._', '');
  if ((s.caption || []).length) lines.push('_Captions sit top-left: keep the top third of the image calm (sky, wall, blur)._', '');
});
const out = path.join(sb.dir, 'prompts.md');
fs.writeFileSync(out, lines.join('\n'));
console.log(`prompts -> ${path.relative(process.cwd(), out)}`);
