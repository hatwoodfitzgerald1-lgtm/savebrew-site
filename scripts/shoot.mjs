#!/usr/bin/env node
// Screenshots a route at several widths with Playwright (Chromium from PLAYWRIGHT_BROWSERS_PATH, never
// "playwright install") and reports what QA looks for: horizontal overflow, any row narrower than the
// viewport minus twice the gutter, any fixed centred container, dashes in shipped text, console errors.
//   node scripts/shoot.mjs /brief 1280,1440,1920,2560,375
//   node scripts/shoot.mjs /_demo 1440 --rm        (the reduced motion path, ?qa=rm)
//   node scripts/shoot.mjs / 1440 --fold            (the first viewport only)
// Uses a running server at SB_BASE (default http://localhost:4321) or starts astro dev and stops it after.
// cdnjs requests (GSAP, Three.js) are fulfilled from node_modules so motion runs in the sandbox.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HMR_STUB = [
  'const noop = () => {};',
  'export const createHotContext = () => ({ accept: noop, acceptExports: noop, dispose: noop, prune: noop, decline: noop, invalidate: noop, on: noop, off: noop, send: noop, data: {} });',
  'export const injectQuery = (u) => u;',
  'export const updateStyle = (id, css) => { let s = document.querySelector("style[data-vite-dev-id=\\"" + id + "\\"]"); if (!s) { s = document.createElement("style"); s.setAttribute("data-vite-dev-id", id); document.head.appendChild(s); } s.textContent = css; };',
  'export const removeStyle = (id) => { const s = document.querySelector("style[data-vite-dev-id=\\"" + id + "\\"]"); if (s) s.remove(); };',
  'export default {};'
].join('\n');

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const route = args[0] || '/';
const widths = (args[1] || '1280,1440,1920,2560,375').split(',').map(Number);
const flags = new Set(args.slice(2));
const base = process.env.SB_BASE || 'http://localhost:4321';
const outDir = path.join(ROOT, 'shots');
fs.mkdirSync(outDir, { recursive: true });

const CDN = {
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js': 'node_modules/gsap/dist/Flip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': 'node_modules/three/build/three.min.js'
};

async function reachable(url) {
  try { const r = await fetch(url, { redirect: 'manual' }); return r.status < 500; } catch { return false; }
}
let server = null;
if (!(await reachable(base + '/_demo'))) {
  const port = new URL(base).port || '4321';
  server = spawn('npx', ['astro', 'dev', '--port', port, '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } });
  for (let i = 0; i < 60; i++) { if (await reachable(base + '/_demo')) break; await new Promise((r) => setTimeout(r, 500)); }
}

const browser = await chromium.launch();
const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
const report = { route, shots: [], issues: [] };
for (const width of widths) {
  const height = width <= 480 ? 812 : 900;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width <= 480, hasTouch: width <= 480 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // the dev server's HMR client would reload the page whenever any agent saves a file mid shoot; it is inert here
  await page.route('**/@vite/client', (r) => r.fulfill({ body: HMR_STUB, contentType: 'application/javascript' }));
  await page.route('https://cdnjs.cloudflare.com/**', async (r) => {
    const f = CDN[r.request().url()];
    if (f && fs.existsSync(path.join(ROOT, f))) r.fulfill({ path: path.join(ROOT, f), contentType: 'application/javascript' });
    else r.abort();
  });
  const url = base + route + (flags.has('--rm') ? (route.includes('?') ? '&' : '?') + 'qa=rm' : '');
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(flags.has('--rm') ? 400 : 1600);
  // scroll through the page so scroll driven entrances fire, then back to the top
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.round(innerHeight * 0.6)) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 220)); }
    scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 500));
  });
  const tag = `${slug}-${width}${flags.has('--rm') ? '-rm' : ''}`;
  const foldPath = path.join(outDir, `${tag}-fold.png`);
  await page.screenshot({ path: foldPath, fullPage: false });
  let fullPath = null;
  if (!flags.has('--fold')) {
    // scroll driven reveals (view() timelines) sit at their start state below the viewport, so the full page shot is taken from the foot of the page, where everything above has passed its range
    await page.evaluate(async () => { scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 1200)); const b = document.querySelector('.band'); if (b) { b.style.position = 'relative'; b.classList.remove('is-hidden'); } const t = document.querySelector('.tabstrip'); if (t) t.style.position = 'relative'; });
    fullPath = path.join(outDir, `${tag}.png`);
    await page.screenshot({ path: fullPath, fullPage: true });
  }
  const audit = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 0;
    const out = { vw, gutter, scrollWidth: document.documentElement.scrollWidth, overflow: [], narrow: [], centred: [], dashes: [], fonts: [] };
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') {
        const cs = getComputedStyle(el);
        if (cs.overflow !== 'hidden' && !el.closest('.sb-app, .scene, .loader, .cart-drawer, .menu')) out.overflow.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
      }
    });
    document.querySelectorAll('.pass, .heading-pass, .board, .wide, section').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < vw - 2 * gutter - 2 && !el.closest('.sb-app, .cart-drawer, .menu') && !el.classList.contains('cell')) out.narrow.push({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 60), width: Math.round(r.width) });
      const cs = getComputedStyle(el);
      if (cs.maxWidth !== 'none' && cs.maxWidth !== '100%' && !el.closest('.sb-app')) out.centred.push({ id: el.id, cls: String(el.className).slice(0, 60), maxWidth: cs.maxWidth });
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.parentElement && n.parentElement.closest('script, style')) continue;
      const t = n.textContent || '';
      if (/[–—]|\s-\s|--/.test(t)) out.dashes.push(t.trim().slice(0, 80));
    }
    out.fonts = Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family);
    return out;
  });
  const issues = [];
  if (audit.scrollWidth > audit.vw + 1) issues.push(`horizontal scroll: scrollWidth ${audit.scrollWidth} > ${audit.vw}`);
  if (audit.overflow.length) issues.push(`overflowing elements: ${JSON.stringify(audit.overflow.slice(0, 6))}`);
  if (audit.narrow.length) issues.push(`rows narrower than the viewport minus two gutters: ${JSON.stringify(audit.narrow.slice(0, 6))}`);
  if (audit.centred.length) issues.push(`max-width on a section level block: ${JSON.stringify(audit.centred.slice(0, 6))}`);
  if (audit.dashes.length) issues.push(`dash punctuation in text: ${JSON.stringify(audit.dashes.slice(0, 6))}`);
  if (errors.length) issues.push(`console errors: ${JSON.stringify(errors.slice(0, 6))}`);
  report.shots.push({ width, fold: foldPath, full: fullPath, fonts: [...new Set(audit.fonts)], issues });
  console.log(`${route} @ ${width}: ${issues.length ? issues.length + ' issue(s)' : 'clean'}  ${fullPath || foldPath}`);
  for (const i of issues) console.log('   ' + i);
  await ctx.close();
}
await browser.close();
if (server) server.kill();
fs.writeFileSync(path.join(outDir, `${slug}-report.json`), JSON.stringify(report, null, 1));
