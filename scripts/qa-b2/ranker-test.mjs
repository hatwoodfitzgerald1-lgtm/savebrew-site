// Drives the ranker at /your-moves (and the embed when given) in Playwright: toggles, the Flip re rank, copy, print.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/claude/savebrew/site';
const base = process.env.SB_BASE || 'http://127.0.0.1:4322';
const route = process.argv[2] || '/your-moves';
const width = Number(process.argv[3] || 1440);
const rm = process.argv.includes('--rm');
const CDN = {
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js': 'node_modules/gsap/dist/Flip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js': 'node_modules/three/build/three.min.js'
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 }, isMobile: width <= 480, hasTouch: width <= 480, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
await page.route('https://cdnjs.cloudflare.com/**', async (r) => { const f = CDN[r.request().url()]; if (f) r.fulfill({ path: path.join(ROOT, f), contentType: 'application/javascript' }); else r.abort(); });
await page.goto(base + route + (rm ? '?qa=rm' : ''), { waitUntil: 'load' });
await page.waitForTimeout(1500);
const rootSel = '[data-ranker]';
const order = () => page.$eval(rootSel, (el) => el.dataset.order);
const state = () => page.$eval(rootSel + ' [data-state-line]', (el) => el.textContent.trim());
const domOrder = () => page.$$eval(rootSel + ' [data-candidate]', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.candidate + (e.classList.contains('is-top') ? '*' : '')));
console.log('ready:', await page.$eval(rootSel, (el) => el.dataset.rankerReady), 'state:', await state());
console.log('initial order:', await order());
console.log('dom order:', (await domOrder()).join(' '));
// scroll the list into view and turn on toggle 3
const t3 = page.locator(rootSel + ' [data-toggle="2"]');
await t3.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await t3.click();
await page.waitForTimeout(150);
console.log('mid state:', await state(), '| aria:', await t3.getAttribute('aria-checked'));
await page.waitForTimeout(900);
console.log('after toggle 3:', await order());
console.log('dom order:', (await domOrder()).join(' '));
console.log('state:', await state());
console.log('reasons:', await page.$$eval(rootSel + ' .is-rest [data-reason]', (els) => els.map((e) => e.textContent)));
await page.screenshot({ path: path.join(ROOT, 'shots', `ranker-test-${width}${rm ? '-rm' : ''}-t3.png`), fullPage: false });
// the keyboard: focus toggle 5 and press space
await page.locator(rootSel + ' [data-toggle="4"]').focus();
await page.keyboard.press('Space');
await page.waitForTimeout(900);
console.log('after toggle 5 by keyboard:', await order(), '|', await state());
// the label click on toggle 1
await page.locator(rootSel + ' .ranker__switch[data-index="0"] .switch__label').click();
await page.waitForTimeout(900);
console.log('after toggle 1 by label:', await order(), '|', await state());
// copy
const copy = page.locator(rootSel + ' [data-copy]');
if (await copy.count()) {
  await copy.click();
  await page.waitForTimeout(500);
  console.log('copied flag:', await page.$eval(rootSel, (el) => el.dataset.copied), '| line:', await page.$eval(rootSel + ' [data-copy-text]', (el) => el.textContent));
  try { console.log('clipboard:\n' + (await page.evaluate(() => navigator.clipboard.readText()))); } catch (e) { console.log('clipboard read failed', String(e)); }
  await page.screenshot({ path: path.join(ROOT, 'shots', `ranker-test-${width}${rm ? '-rm' : ''}-copied.png`), fullPage: false });
  // print: emulate print media with the class set
  await page.evaluate(() => document.body.classList.add('ranker-print'));
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(ROOT, 'shots', `ranker-test-${width}-print.png`), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => document.body.classList.remove('ranker-print'));
}
// all off again
for (const i of [0, 2, 4]) { await page.locator(rootSel + ` [data-toggle="${i}"]`).click(); await page.waitForTimeout(200); }
await page.waitForTimeout(900);
console.log('all off:', await order(), '|', await state());
// the CTA adds SB101 and opens the drawer
const cta = page.locator(rootSel + ' .ranker__bobbin');
if (await cta.count()) {
  await cta.scrollIntoViewIfNeeded();
  await cta.click();
  await page.waitForTimeout(700);
  console.log('cart:', await page.evaluate(() => localStorage.getItem('savebrew.cart')), '| drawer open:', await page.evaluate(() => document.body.classList.contains('cart-open') || !!document.querySelector('.cart-drawer.is-open, .cart-drawer[aria-hidden="false"]')));
  await page.screenshot({ path: path.join(ROOT, 'shots', `ranker-test-${width}-cart.png`), fullPage: false });
}
console.log('console:', errors.filter((e) => !/404|Failed to load resource/.test(e)));
await browser.close();
