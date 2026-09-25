// The 404 search, the contact form validation and success state, the yesterday strip on /brief, the guide word counts.
import { chromium } from 'playwright';
import path from 'node:path';
const ROOT = '/home/claude/savebrew/site';
const base = process.env.SB_BASE || 'http://127.0.0.1:4322';
const CDN = { 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js': 'node_modules/gsap/dist/gsap.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js': 'node_modules/gsap/dist/Flip.min.js' };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
await page.route('https://cdnjs.cloudflare.com/**', (r) => { const f = CDN[r.request().url()]; f ? r.fulfill({ path: path.join(ROOT, f), contentType: 'application/javascript' }) : r.abort(); });
// 404 search
const res = await page.goto(base + '/nope', { waitUntil: 'load' });
console.log('404 status:', res.status());
await page.fill('#nf-query', 'coupon');
await page.click('.nf-search__submit');
await page.waitForTimeout(200);
console.log('search "coupon":', await page.$$eval('.nf-results__title', (els) => els.map((e) => e.textContent)));
await page.fill('#nf-query', 'zzzz');
await page.click('.nf-search__submit');
await page.waitForTimeout(200);
console.log('search "zzzz":', await page.$eval('[data-guide-empty]', (e) => e.textContent));
await page.fill('#nf-query', 'patio');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
console.log('search "patio":', await page.$$eval('.nf-results__title', (els) => els.map((e) => e.textContent)));
// contact form
await page.goto(base + '/contact', { waitUntil: 'load' });
await page.click('.ct-form__submit');
await page.waitForTimeout(200);
console.log('contact empty submit summary:', await page.$$eval('[data-summary-list] a', (els) => els.map((e) => e.textContent)), '| summary hidden:', await page.$eval('[data-summary]', (e) => e.hidden));
await page.fill('#ct-email', 'not-an-email');
await page.locator('#ct-email').blur();
await page.waitForTimeout(500);
console.log('email format error:', await page.$eval('#ct-email-error', (e) => e.hidden + ' ' + e.textContent.trim()));
await page.fill('#ct-name', 'Jordan Miles');
await page.fill('#ct-email', 'jordan@example.com');
await page.fill('#ct-message', 'A question about the Daily for Two.');
await page.click('.ct-form__submit');
await page.waitForTimeout(150);
console.log('sending label:', await page.$eval('.ct-form__submit .bobbin__label', (e) => e.textContent));
await page.waitForTimeout(900);
console.log('success:', await page.$eval('[data-success]', (e) => e.hidden + ' | ' + e.textContent.replace(/\s+/g, ' ').trim()), '| form hidden:', await page.$eval('[data-contact-form]', (e) => e.hidden));
await page.screenshot({ path: path.join(ROOT, 'shots', 'contact-success-1440.png') });
// yesterday strip on /brief
await page.goto(base + '/brief', { waitUntil: 'load' });
await page.locator('[data-ypass-knot="2"]').scrollIntoViewIfNeeded();
await page.locator('[data-ypass-knot="2"]').hover();
await page.waitForTimeout(300);
console.log('yesterday coupons:', await page.$eval('[data-ypass-item="2"]', (e) => e.hidden + ' | ' + e.querySelector('h3').textContent));
await page.locator('[data-ypass-knot="4"]').focus();
await page.waitForTimeout(200);
console.log('yesterday paycheck (focus):', await page.$eval('[data-ypass-item="4"]', (e) => e.hidden + ' | ' + e.querySelector('h3').textContent), '| coupons hidden:', await page.$eval('[data-ypass-item="2"]', (e) => e.hidden));
console.log('inert chip aria-disabled:', await page.$eval('[data-inert-chip]', (e) => e.getAttribute('aria-disabled')));
// guide word counts in the rendered DOM
for (const slug of ['make-a-rotating-category-pay', 'the-national-average-is-a-warning', 'four-percent-against-the-account-you-have', 'why-patio-furniture-is-cheap-in-october']) {
  await page.goto(base + '/guides/' + slug, { waitUntil: 'load' });
  const n = await page.$eval('.guide-body__prose', (e) => e.textContent.split(/\s+/).filter(Boolean).length);
  const declared = await page.$eval('.guide', (e) => e.dataset.words);
  const h2s = await page.$$eval('.guide-body__h2', (els) => els.length);
  const pull = await page.$eval('.guide-pull__text', (e) => e.textContent.slice(0, 60));
  console.log(slug, 'rendered words', n, 'declared', declared, 'h2s', h2s, 'pull:', pull);
}
// membership cadence and cancel knots
await page.goto(base + '/membership', { waitUntil: 'load' });
await page.click('[data-cadence-pick="yearly"]');
await page.waitForTimeout(300);
console.log('yearly labels:', await page.$$eval('#daily .bobbin__label, #daily-for-two .bobbin__label', (els) => els.map((e) => e.textContent)));
console.log('errors:', errors);
await browser.close();
