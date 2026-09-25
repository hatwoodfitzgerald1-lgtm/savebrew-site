// THE TWILL tile (3.16 surface two): the over two under two diagonal weave at 6 percent contrast on the
// butter ground, 8px pitch, 6px threads, a 96px tile. Shared by surfaces.ts (client) and scripts/build-twill.mjs.
export function drawTwill(ctx, tile = 96) {
  const pitch = 8, threadW = 6;
  const BUTTER = '#F6E7A1';
  const light = 'rgba(255, 255, 255, 0.30)';
  const dark = 'rgba(43, 47, 143, 0.06)';
  ctx.clearRect(0, 0, tile, tile);
  ctx.fillStyle = BUTTER; ctx.fillRect(0, 0, tile, tile);
  const n = tile / pitch;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = i * pitch, y = j * pitch;
      const weftOver = ((i + j) % 4) < 2;   // 2/2 twill: the crossing shifts one thread per row, so the ridge lies at 45 degrees
      ctx.fillStyle = weftOver ? light : dark;
      ctx.fillRect(x + 1, y + 1, threadW, threadW);
      ctx.fillStyle = weftOver ? dark : light;
      if (weftOver) ctx.fillRect(x + 1, y + 1, threadW, 2); else ctx.fillRect(x + 1, y + 1, 2, threadW);
    }
  }
}
