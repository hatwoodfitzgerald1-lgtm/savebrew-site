#!/usr/bin/env node
// Copies the shipped assets from /home/claude/savebrew/assets into public/assets (served at /assets/...).
// Rerunnable: run it again whenever the asset engine lands new files (the awaiting photos, the hero loop).
// Nothing is hotlinked; everything the site references lives under public/assets.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SB_ASSETS || '/home/claude/savebrew/assets';
const OUT = path.resolve(new URL('..', import.meta.url).pathname, 'public/assets');
const DATA_OUT = path.resolve(new URL('..', import.meta.url).pathname, 'public/data');

const copied = [];
function cp(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied.push(path.relative(OUT, to));
  return true;
}
function cpDir(from, to, filter = () => true) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, entry.name);
    const t = path.join(to, entry.name);
    if (entry.isDirectory()) cpDir(f, t, filter);
    else if (filter(entry.name, f)) cp(f, t);
  }
}

// brand kit: only what the site ships (favicons, OG image, logo lockups)
cpDir(path.join(SRC, 'brand-kit/favicon'), path.join(OUT, 'brand/favicon'));
cp(path.join(SRC, 'brand-kit/banners/og-1200x630.png'), path.join(OUT, 'brand/og-1200x630.png'));
cpDir(path.join(SRC, 'brand-kit/logo'), path.join(OUT, 'brand/logo'), (n) => n.endsWith('.svg') || n === 'savebrew-icon-512.png');
// the graphic kit
cpDir(path.join(SRC, 'kit-svg'), path.join(OUT, 'kit'));
// product shots (WebP only; the PNG masters stay in the asset folder)
cpDir(path.join(SRC, 'product'), path.join(OUT, 'product'), (n) => n.endsWith('.webp'));
// video and posters
cpDir(path.join(SRC, 'video'), path.join(OUT, 'video'), (n) => /\.(mp4|webp)$/.test(n) && !/^hero-clip|hero-concat/.test(n));
// texture
cpDir(path.join(SRC, 'texture'), path.join(OUT, 'texture'), (n) => n.endsWith('.webp'));
// photographs (the awaiting slots land here under the names ASSET_PLAN.json gives)
cpDir(path.join(SRC, 'photo'), path.join(OUT, 'photo'), (n) => /\.(webp|avif)$/.test(n));
// font licences beside the subset fonts (the woff2 files are built by scripts/build-fonts.py)
cpDir(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'), (n) => n.startsWith('OFL-'));
// the ranker candidates, as a public data file
cp(path.join('/home/claude/savebrew/spec/copy/moves.json'), path.join(DATA_OUT, 'moves.json'));

console.log(`copy-assets: ${copied.length} files into public/assets (and public/data/moves.json)`);
const photo = fs.existsSync(path.join(OUT, 'photo')) ? fs.readdirSync(path.join(OUT, 'photo')) : [];
if (photo.length === 0) console.warn('copy-assets: WARNING photo/ is empty; the photo.* slots are still awaiting transfer from the asset engine');

// ---- vendored scripts (from node_modules, pinned in package.json) ----
const NM = path.resolve(new URL('..', import.meta.url).pathname, 'node_modules');
const JS = path.join(OUT, 'js');
fs.mkdirSync(JS, { recursive: true });
// the scroll-timeline polyfill for Safari (EXP-005), self hosted
cp(path.join(NM, 'scroll-timeline-polyfill/dist/scroll-timeline.js'), path.join(JS, 'scroll-timeline.js'));
// the Three.js r128 fat line classes (Line2 and friends) as one static file; cdnjs serves only the core build
const lines = ['LineSegmentsGeometry', 'LineGeometry', 'LineMaterial', 'LineSegments2', 'Line2']
  .map((n) => path.join(NM, 'three/examples/js/lines', n + '.js'));
if (lines.every((f) => fs.existsSync(f))) {
  const banner = '// Three.js r128 examples/js/lines, vendored: LineSegmentsGeometry, LineGeometry, LineMaterial, LineSegments2, Line2. MIT, (c) 2010-2021 three.js authors.\n';
  fs.writeFileSync(path.join(JS, 'three-lines-r128.js'), banner + lines.map((f) => fs.readFileSync(f, 'utf8')).join('\n'));
  copied.push('js/three-lines-r128.js');
  console.log('copy-assets: wrote js/three-lines-r128.js');
}

// ---- the asset plan, bundled so the build never reads the asset folder at request time ----
const DATA = path.resolve(new URL('..', import.meta.url).pathname, 'src/data');
fs.mkdirSync(DATA, { recursive: true });
const plan = JSON.parse(fs.readFileSync(path.join(SRC, 'ASSET_PLAN.json'), 'utf8'));
const slim = {
  brand: plan.brand, public_root: plan.public_root, weight_budget: plan.weight_budget, updated: plan.updated,
  slots: plan.slots.map((s) => ({ id: s.id, role: s.role, aspect: s.aspect, lives_on: s.lives_on, files: s.files, status: s.status, crop_note: s.crop_note || null }))
};
fs.writeFileSync(path.join(DATA, 'asset-plan.json'), JSON.stringify(slim, null, 1));
console.log('copy-assets: wrote src/data/asset-plan.json');
