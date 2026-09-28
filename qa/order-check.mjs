// Reading order: in every row board, the cells' visual order (top, then left) must follow the DOM order.
// Usage: SB_BASE=http://127.0.0.1:4350 node qa/order-check.mjs [comma separated routes] [comma separated widths]
// The pass grid packs dense, so a spanning cell can pull a later cell ahead of an earlier one; this lists every board where it does.
import { chromium } from 'playwright';
const base = process.env.SB_BASE || 'http://127.0.0.1:4350';
const routes = (process.argv[2] || '/').split(',');
const widths = (process.argv[3] || '1100').split(',').map(Number);
const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', (rt) => rt.abort());
  const found = [];
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: 'load' }); await page.waitForTimeout(200);
    const res = await page.evaluate(() => {
      const out = [];
      for (const board of document.querySelectorAll('main .board, main .pass')) {
        const cells = Array.from(board.children).filter((c) => c.classList.contains('cell') && c.getBoundingClientRect().height > 0);
        if (cells.length < 2) continue;
        const pos = cells.map((c, i) => { const rc = c.getBoundingClientRect(); return { i, top: Math.round(rc.top), left: Math.round(rc.left), name: (c.className || '').split(' ').filter((x) => x !== 'cell').slice(0, 2).join('.') + (c.dataset.thread ? `[${c.dataset.thread}]` : '') }; });
        const vis = pos.slice().sort((a, b) => (Math.abs(a.top - b.top) > 8 ? a.top - b.top : a.left - b.left));
        if (vis.some((p, k) => p.i !== k)) out.push(`${board.id || board.className.split(' ').slice(0, 2).join('.')}: visual ${vis.map((p) => p.i).join(',')} :: ${vis.map((p) => p.name).join(' | ')}`);
      }
      return out;
    });
    for (const x of res) found.push(`${r} ${x}`);
  }
  console.log(`${w}: ${found.length} boards out of order`);
  for (const f of found) console.log('   ', f);
  await ctx.close();
}
await browser.close();
