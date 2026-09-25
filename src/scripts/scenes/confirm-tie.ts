// /confirmation scene (design document 7.15): the seal's last stitch tying off. The Selvedge Seal sits inside
// the root already woven; this canvas draws a running stitch around its border with the final stretch drawing
// on load (Shuttle over 1.2s) and a knot pulling tight at the corner (Knot). Static and complete under reduced
// motion. Root: [data-scene="confirm-tie"], a box a little larger than the seal it wraps.
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

class ConfirmTie extends Scene {
  t0 = performance.now();
  resize() {}
  frame(now: number) {
    if (this.t0 == null) return;
    const ctx = this.ctx;
    const inset = 6;
    const x0 = inset, y0 = inset, x1 = this.w - inset, y1 = this.h - inset;
    const perim = 2 * (x1 - x0) + 2 * (y1 - y0);
    const elapsed = now - this.t0;
    // the first 86 percent of the border is already stitched; the last stretch draws over 1.2s, then the knot ties
    const already = 0.86;
    const draw = this.reduced ? 1 : Math.min(1, elapsed / DUR.slow);
    const reach = perim * (already + (1 - already) * SHUTTLE(draw));
    const tie = this.reduced ? 1 : KNOT(Math.max(0, Math.min(1, (elapsed - DUR.slow) / DUR.base)));
    ctx.strokeStyle = INDIGO; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath();
    // walk the perimeter clockwise from the top left corner, 6 on and 4 off
    let pos = 0;
    while (pos < reach) {
      const end = Math.min(reach, pos + 6);
      const a = this.point(pos, x0, y0, x1, y1), b = this.point(end, x0, y0, x1, y1);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      pos += 10;
    }
    ctx.stroke();
    if (draw >= 1) {
      // the knot at the top left corner where the stitch closes, scaling from loose to tight
      const s = (16 / 24) * (1.3 - 0.3 * tie);
      ctx.save();
      ctx.translate(x0 - 12 * s, y0 - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 2 / s * 1.5;
      ctx.strokeStyle = DEEP;
      ctx.globalAlpha = 0.3 + 0.7 * tie;
      ctx.stroke(KNOT_PATH);
      ctx.restore();
      if (tie >= 1) this.stop();
    }
  }
  private point(d: number, x0: number, y0: number, x1: number, y1: number): [number, number] {
    const w = x1 - x0, h = y1 - y0;
    if (d <= w) return [x0 + d, y0];
    if (d <= w + h) return [x1, y0 + (d - w)];
    if (d <= 2 * w + h) return [x1 - (d - w - h), y1];
    return [x0, y1 - (d - 2 * w - h)];
  }
}
export default function mount(root: HTMLElement) {
  return new ConfirmTie(root);
}
