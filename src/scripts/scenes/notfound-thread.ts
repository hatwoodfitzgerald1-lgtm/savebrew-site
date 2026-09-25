// The 404 scene (3.7, 7.23): a loose thread that curls. One indigo thread runs across the band through a faint
// woven field, then curls out of the weave at the right and settles (Knot, slow); the loose end sways at idle.
// Static, curled, under reduced motion. Root: <PageScene kind="notfound-thread" height="120px" />
import { Scene } from './base';
import { KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const PALE = '#EBD77A';

class NotFoundThread extends Scene {
  t0 = performance.now();
  resize() { /* drawn from the width each frame */ }
  frame(now: number) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const y = h * 0.55;
    const elapsed = now - this.t0;
    const k = this.reduced ? 1 : KNOT(Math.min(1, elapsed / DUR.slow));
    const sway = this.reduced ? 0 : Math.sin(now / 1700) * 4;
    // the woven field the thread has come loose from: faint warp and weft in pale butter on the left two thirds
    ctx.strokeStyle = PALE;
    ctx.lineWidth = 1;
    const fieldW = w * 0.62;
    for (let x = 8; x < fieldW; x += 10) { ctx.beginPath(); ctx.moveTo(x + 0.5, h * 0.15); ctx.lineTo(x + 0.5, h * 0.95); ctx.stroke(); }
    for (let yy = h * 0.15; yy < h * 0.95; yy += 10) { ctx.beginPath(); ctx.moveTo(0, yy + 0.5); ctx.lineTo(fieldW, yy + 0.5); ctx.stroke(); }
    // the thread: straight through the weave, then it leaves the cloth and curls
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(fieldW, y);
    const cx = fieldW + (w - fieldW) * 0.42;
    const r = 22 * k;
    // out of the weave: a rising arc into a curl of one and a half turns, growing as it settles
    ctx.bezierCurveTo(fieldW + 40, y, cx - r * 1.6, y - r * 2.2 * k, cx, y - r * 2 * k);
    ctx.stroke();
    ctx.beginPath();
    const turns = 1.5 * k;
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * turns * Math.PI * 2;
      const rr = r * (0.4 + 0.6 * (i / steps));
      const px = cx + Math.cos(a - Math.PI / 2) * rr;
      const py = (y - r * 2 * k) + rr + Math.sin(a - Math.PI / 2) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    // the loose end trails off to the right and sways
    const endX = cx + r * 1.2;
    const endY = y - r * 2 * k + r * 2.2;
    ctx.quadraticCurveTo(endX + 30, endY + 10 + sway, Math.min(w - 4, endX + 90), endY - 6 + sway * 1.5);
    ctx.stroke();
    if (this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new NotFoundThread(root);
}
