// /checkout scene (design document 7.14): a running stitch down the left gutter that advances one section at a
// time. It draws to the first section head on load, then to the foot of Contact when Contact validates, to the
// foot of Billing address when that validates, and so on, tying a small knot at each section head (Knot).
// The checkout script drives it with "sb:checkout-progress" events ({ reach, knots } in px from the root's top).
// Reduced motion: the whole stitch, complete, with every knot tied. Root: [data-scene="checkout-stitch"].
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

interface Progress { reach: number; knots: number[] }

class CheckoutStitch extends Scene {
  shown = 0;          // the y the stitch has reached
  target = 0;         // the y it is drawing toward
  from = 0;
  tStart = 0;
  knots: number[] = [];
  tied: number[] = [];   // the time each knot started tying
  seed = 'checkout';
  private onProgress = (e: any) => {
    const p = e.detail as Progress;
    this.knots = p.knots.slice();
    if (p.reach > this.target) { this.from = this.shown; this.target = p.reach; this.tStart = performance.now(); }
    else if (p.reach < this.target) { this.target = p.reach; this.shown = Math.min(this.shown, p.reach); }
    this.start();
  };
  constructor(root: HTMLElement) {
    super(root);
    document.addEventListener('sb:checkout-progress', this.onProgress);
  }
  dispose() { super.dispose(); document.removeEventListener('sb:checkout-progress', this.onProgress); }
  resize() {}
  frame(now: number) {
    if (!Array.isArray(this.knots)) return;   // the base class draws once before the fields above exist
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const x = Math.max(8, w / 2);
    if (this.reduced) { this.shown = h; }
    else if (this.shown < this.target) {
      const p = SHUTTLE(Math.min(1, (now - this.tStart) / DUR.slow));
      this.shown = this.from + (this.target - this.from) * p;
    }
    const limit = Math.min(h, this.shown);
    // the running stitch: 6 on, 4 off, 2px, with a little jitter so it reads as thread
    ctx.strokeStyle = INDIGO; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath();
    let pos = 4, i = 0;
    while (pos < limit) {
      const len = 6 + ((i * 7) % 3) * 0.5;
      const end = Math.min(limit, pos + len);
      const drift = ((i * 13) % 5 - 2) * 0.25;
      ctx.moveTo(x + drift, pos);
      ctx.lineTo(x - drift, end);
      pos += len + 4; i++;
    }
    ctx.stroke();
    // the knots at the section heads the stitch has reached, each pulling tight once (Knot)
    const knots = this.reduced ? this.knots : this.knots.filter((y) => y <= this.shown + 1);
    knots.forEach((y, k) => {
      if (this.tied[k] == null) this.tied[k] = now;
      const t = this.reduced ? 1 : KNOT(Math.min(1, (now - this.tied[k]) / DUR.base));
      const s = (14 / 24) * (1.3 - 0.3 * t);
      ctx.save();
      ctx.translate(x - 12 * s, y - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 2 / s * 1.4;
      ctx.strokeStyle = DEEP;
      ctx.globalAlpha = 0.4 + 0.6 * t;
      ctx.stroke(KNOT_PATH);
      ctx.restore();
    });
    // rest once everything has been drawn
    if (this.reduced || (this.shown >= this.target && this.tied.length >= knots.length && knots.every((_, k) => now - this.tied[k] > DUR.base))) this.stop();
  }
}
export default function mount(root: HTMLElement) {
  return new CheckoutStitch(root);
}
