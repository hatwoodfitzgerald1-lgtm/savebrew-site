// Voids inside row boards: a cell whose content ends far above the row's bottom (ragged heights) leaves an empty white block.
// Usage: SB_BASE=http://127.0.0.1:4350 node qa/void-check.mjs [comma separated routes] [comma separated widths]
// Flags a cell when the gap between its last child and its bottom is over 180px and over 30 percent of the cell.
import { chromium } from 'playwright';
const base = process.env.SB_BASE || 'http://127.0.0.1:4350';
const routes = (process.argv[2] || '/,/brief,/membership,/guides,/your-moves,/about,/guides/make-a-rotating-category-pay,/guides/the-national-average-is-a-warning,/roundup,/contact,/checkout,/cart,/terms,/privacy,/today').split(',');
const widths = (process.argv[3] || '1024,1280,1440,1920,2560').split(',').map(Number);
const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', (rt) => rt.abort());
  const found = [];
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: 'load' }); await page.waitForTimeout(250);
    const res = await page.evaluate(() => {
      const out = [];
      for (const board of document.querySelectorAll('main .board, main .pass')) {
        const cells = Array.from(board.children).filter((c) => c.classList.contains('cell') && c.getBoundingClientRect().height > 0);
        if (cells.length < 2) continue;
        for (const c of cells) {
          const cr = c.getBoundingClientRect();
          const kids = Array.from(c.children).filter((k) => k.getBoundingClientRect().height > 0);
          if (!kids.length) continue;
          const contentBottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
          const pad = parseFloat(getComputedStyle(c).paddingBottom) || 0;
          const empty = cr.bottom - pad - contentBottom;
          if (empty > 180 && empty / cr.height > 0.3) out.push({ board: board.id || board.className.split(' ').slice(0, 3).join('.'), cell: (c.className || '').split(' ').slice(0, 3).join('.'), empty: Math.round(empty), h: Math.round(cr.height), w: Math.round(cr.width) });
        }
      }
      return out;
    });
    for (const x of res) found.push(`${r} ${x.board} :: ${x.cell} empty ${x.empty}px of ${x.h}px (w ${x.w})`);
  }
  console.log(`${w}: ${found.length} voids`);
  for (const f of found) console.log('   ', f);
  await ctx.close();
}
await browser.close();
