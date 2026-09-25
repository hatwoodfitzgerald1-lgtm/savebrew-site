// Probes a page: loader state, the prose column boxes, word counts. node scripts/qa-b2/probe.mjs /guides/slug 1440
import { chromium } from 'playwright';
import path from 'node:path';
const ROOT = '/home/claude/savebrew/site';
const base = process.env.SB_BASE || 'http://127.0.0.1:4322';
const route = process.argv[2] || '/';
const width = Number(process.argv[3] || 1440);
const CDN = { 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js': 'node_modules/gsap/dist/Flip.min.js' };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e));
await page.route('https://cdnjs.cloudflare.com/**', (r) => { const f = CDN[r.request().url()]; f ? r.fulfill({ path: path.join(ROOT, f), contentType: 'application/javascript' }) : r.abort(); });
await page.goto(base + route, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const out = { loaded: document.documentElement.dataset.loaded, loaderDone: document.querySelector('.loader')?.classList.contains('is-done'), scenes: Array.from(document.querySelectorAll('[data-scene]')).map((s) => s.dataset.scene + ':' + s.dataset.sceneState) };
  const prose = document.querySelector('.guide-body__prose');
  if (prose) {
    const r = prose.getBoundingClientRect();
    out.prose = { w: Math.round(r.width), h: Math.round(r.height), cols: getComputedStyle(prose).columnCount, colWidth: getComputedStyle(prose).columnWidth, text: prose.textContent.split(/\s+/).filter(Boolean).length };
    out.children = Array.from(prose.children).slice(0, 8).map((c) => { const b = c.getBoundingClientRect(); return `${c.tagName}.${c.className} x${Math.round(b.left)} y${Math.round(b.top + scrollY)} w${Math.round(b.width)} h${Math.round(b.height)}`; });
  }
  const art = document.querySelector('.guide');
  if (art) out.words = art.dataset.words;
  return out;
});
console.log(JSON.stringify(info, null, 1));
console.log(logs.filter((l) => !/404/.test(l)).slice(0, 10));
await browser.close();
