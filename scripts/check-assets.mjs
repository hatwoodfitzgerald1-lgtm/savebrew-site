#!/usr/bin/env node
// Resolves every ASSET_PLAN.json slot against public/assets at build time and writes
// src/data/asset-status.json (which renditions exist per slot). Missing slots are reported loudly
// so QA sees them; the build still emits <picture> markup for the named paths (the files land later).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PUBLIC = path.join(ROOT, 'public');
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/asset-plan.json'), 'utf8'));
const STILL_WIDTHS = [800, 1200, 1600, 2400];
const PHONE_WIDTHS = [800, 1200];
const exists = (p) => fs.existsSync(path.join(PUBLIC, p));
const status = { checked: new Date().toISOString(), slots: {}, missing: [] };

for (const slot of plan.slots) {
  const files = slot.files || {};
  const entry = { id: slot.id, present: true, files: {}, renditions: { desktop: [], phone: [], avif: [] } };
  for (const [k, p] of Object.entries(files)) {
    if (typeof p !== 'string' || !p.startsWith('/assets/')) continue;
    entry.files[k] = { path: p, exists: exists(p) };
    if (!exists(p)) entry.present = false;
  }
  if (slot.id.startsWith('photo.')) {
    const base = files.src.replace(/\.webp$/, '');
    for (const w of STILL_WIDTHS) if (exists(`${base}-${w}.webp`)) entry.renditions.desktop.push(w);
    for (const w of PHONE_WIDTHS) if (exists(`${base}-phone-${w}.webp`)) entry.renditions.phone.push(w);
    if (exists(`${base}-1600.avif`)) entry.renditions.avif.push(1600);
  }
  if (files.dir) entry.present = true; // kit folders are copied whole
  status.slots[slot.id] = entry;
  if (!entry.present) status.missing.push(slot.id);
}
status.twill = exists('/assets/texture/twill.webp');
fs.writeFileSync(path.join(ROOT, 'src/data/asset-status.json'), JSON.stringify(status, null, 1));
console.log(`check-assets: ${plan.slots.length} slots, ${status.missing.length} missing`);
if (status.missing.length) {
  console.warn('\n' + '!'.repeat(78));
  console.warn('check-assets: MISSING ASSET SLOTS (the markup is emitted for their named paths; the files must land before deploy):');
  for (const id of status.missing) console.warn('   ' + id + '  ->  ' + Object.values(status.slots[id].files).map((f) => f.path).join(', '));
  console.warn('!'.repeat(78) + '\n');
}
if (!status.twill) console.warn('check-assets: /assets/texture/twill.webp is not pre rendered yet (run npm run twill); the client renders the twill until it is');
