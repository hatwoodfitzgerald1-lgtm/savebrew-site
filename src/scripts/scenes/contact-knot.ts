// /contact scene: a single knot tied at the address line. One thread comes in along the line from the left
// edge, loops once at the address and pulls tight (Knot easing); the tail sways on a slow cycle at idle;
// reduced motion draws the tied knot. Root: <PageScene kind="contact-knot" data-anchor="0.34" />.
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

class ContactKnot extends Scene {
  t0 = performance.now();
  anchor = 0.34;
  scale = 3;
  resize() {
    this.anchor = Number(this.root.dataset.anchor || 0.34);
    this.scale = Math.max(2, Math.min(4, this.h / 24));
  }
  frame(now: number) {
    const ctx = this.ctx;
    const y = this.h / 2;
    const ax = this.w * this.anchor;
    const elapsed = now - this.t0;
    // phase one, 0 to 1.2s: the thread travels in along the line (Shuttle)
    const travel = this.reduced ? 1 : SHUTTLE(Math.min(1, elapsed / DUR.slow));
    // phase two, 1.2s to 1.58s: the loop forms and pulls tight with the overshoot (Knot)
    const tie = this.reduced ? 1 : KNOT(Math.max(0, Math.min(1, (elapsed - DUR.slow) / DUR.base)));
    // idle: the tail sways on a 7 second cycle once the knot is tied, tightening a touch with scroll
    const sway = this.reduced ? 0 : Math.sin((now / 7000) * Math.PI * 2) * 6 * tie;
    const tighten = 1 - 0.06 * this.progress();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2;
    // the thread, from the left edge to the knot
    const headX = Math.min(ax, this.w * travel * 1.05);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(headX * 0.5, y + sway * 0.4, headX * 0.8, y - sway * 0.3, headX, y);
    ctx.stroke();
    if (travel >= 0.999) {
      // the knot: drawn at the anchor, scaling from 1.18 to 1.0 as it pulls tight (the overshoot comes from the curve)
      const s = this.scale * (1.18 - 0.18 * tie) * tighten;
      ctx.save();
      ctx.translate(ax - 12 * s, y - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 2 / s * 2;
      ctx.strokeStyle = DEEP;
      ctx.globalAlpha = 0.35 + 0.65 * tie;
      ctx.stroke(KNOT_PATH);
      ctx.restore();
      // the tail, continuing past the knot to the right and swaying
      const tailX = ax + 21.5 * s - 12 * s;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INDIGO;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, y);
      ctx.bezierCurveTo(tailX + 60, y + sway, this.w - 80, y - sway * 0.6, this.w, y + sway * 0.2);
      ctx.stroke();
    }
    if (this.reduced || (travel >= 1 && tie >= 1 && !this.running)) return;
  }
}
export default function mount(root: HTMLElement) {
  return new ContactKnot(root);
}
