// Horizontal voids inside row boards: a cell whose painted content (text lines, images, svg, video, canvas, boxes with a
// border or a background) ends far short of the cell's right edge over a tall stretch leaves an empty white block.
// Usage: SB_BASE=http://127.0.0.1:4350 node qa/hfill-check.mjs [comma separated routes] [comma separated widths]
// Flags a cell over 240px tall whose content stops more than 200px and 30 percent short of its right edge.
import { chromium } from 'playwright';
const base = process.env.SB_BASE || 'http://127.0.0.1:4350';
const routes = (process.argv[2] || '/').split(',');
const widths = (process.argv[3] || '1024,1440,1920,2560').split(',').map(Number);
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
      const painted = (cell) => {
        const rects = [];
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = walker.nextNode())) {
          if (n.nodeType === 3) {
            if (!n.textContent.trim()) continue;
            const rg = document.createRange(); rg.selectNodeContents(n);
            for (const rc of rg.getClientRects()) if (rc.width > 0 && rc.height > 0) rects.push(rc);
          } else {
            const el = n; const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const tag = el.tagName.toLowerCase();
            const boxy = (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || cs.boxShadow !== 'none' || cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px';
            if (['img', 'svg', 'video', 'canvas', 'iframe', 'picture', 'input', 'select', 'textarea', 'button'].includes(tag) || (boxy && el !== cell) || el.classList.contains('sb-app')) {
              const rc = el.getBoundingClientRect(); if (rc.width > 0 && rc.height > 0) rects.push(rc);
            }
          }
        }
        return rects;
      };
      for (const board of document.querySelectorAll('main .board, main .pass')) {
        const cells = Array.from(board.children).filter((c) => c.classList.contains('cell') && c.getBoundingClientRect().height > 0);
        for (const c of cells) {
          const cr = c.getBoundingClientRect(); const cs = getComputedStyle(c);
          const right = cr.right - (parseFloat(cs.paddingRight) || 0);
          const rects = painted(c);
          if (!rects.length) continue;
          const maxR = Math.max(...rects.map((x) => x.right));
          const empty = right - maxR;
          if (empty > 200 && empty / cr.width > 0.3 && cr.height > 240) out.push({ board: board.id || board.className.split(' ').slice(0, 3).join('.'), cell: (c.className || '').split(' ').slice(0, 3).join('.'), empty: Math.round(empty), w: Math.round(cr.width), h: Math.round(cr.height) });
        }
      }
      return out;
    });
    for (const x of res) found.push(`${r} ${x.board} :: ${x.cell} empty right ${x.empty}px of ${x.w}px (h ${x.h})`);
  }
  console.log(`${w}: ${found.length} horizontal voids`);
  for (const f of found) console.log('   ', f);
  await ctx.close();
}
await browser.close();
