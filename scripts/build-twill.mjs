#!/usr/bin/env node
// Pre renders THE TWILL tile to public/assets/texture/twill.webp (96px at 2x) with Chromium and PIL, so the
// footer, the membership row and the legal margins tile a real file and the client never has to draw it.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const src = fs.readFileSync(path.join(ROOT, 'src/scripts/twill-tile.js'), 'utf8').replace(/^export /m, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 2 });
await page.setContent('<canvas id="c" width="192" height="192" style="width:96px;height:96px"></canvas>');
const dataUrl = await page.evaluate((code) => {
  const fn = new Function(code + '; return drawTwill;')();
  const c = document.getElementById('c'); const ctx = c.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0);
  fn(ctx, 96);
  return c.toDataURL('image/png');
}, src);
await browser.close();
const png = path.join(ROOT, 'public/assets/texture/twill.png');
fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
const webp = path.join(ROOT, 'public/assets/texture/twill.webp');
execFileSync('python3', ['-c', `from PIL import Image; Image.open('${png}').convert('RGB').save('${webp}', 'WEBP', quality=90, method=6)`]);
fs.unlinkSync(png);
console.log('build-twill: wrote public/assets/texture/twill.webp', fs.statSync(webp).size, 'bytes');
