// /sign-in scene (design document 7.20): the selvedge stitch draws around the sign in card as a border when the
// email field validates (Shuttle, base), tying off at the button (Knot). It listens for "sb:signin-valid" and
// "sb:signin-invalid" on the document; reduced motion draws the finished border at once.
// Root: [data-scene="signin-stitch"], a box wrapping the card.
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

class SigninStitch extends Scene {
  t0 = -1;
  valid = false;
  private onValid = () => { if (!this.valid) { this.valid = true; this.t0 = performance.now(); this.start(); } };
  private onInvalid = () => { this.valid = false; this.t0 = -1; this.start(); };
  constructor(root: HTMLElement) {
    super(root);
    document.addEventListener('sb:signin-valid', this.onValid);
    document.addEventListener('sb:signin-invalid', this.onInvalid);
  }
  dispose() { super.dispose(); document.removeEventListener('sb:signin-valid', this.onValid); document.removeEventListener('sb:signin-invalid', this.onInvalid); }
  resize() {}
  frame(now: number) {
    if (this.t0 == null) return;
    const ctx = this.ctx;
    const inset = 3;
    const x0 = inset, y0 = inset, x1 = this.w - inset, y1 = this.h - inset;
    const w = x1 - x0, h = y1 - y0;
    const perim = 2 * w + 2 * h;
    let p: number;
    if (this.reduced) p = 1;
    else if (!this.valid) { this.stop(); return; }
    else p = SHUTTLE(Math.min(1, (now - this.t0) / DUR.slow));
    const reach = perim * p;
    ctx.strokeStyle = INDIGO; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath();
    let pos = 0;
    while (pos < reach) {
      const end = Math.min(reach, pos + 6);
      const a = this.point(pos, x0, y0, w, h), b = this.point(end, x0, y0, w, h);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      pos += 10;
    }
    ctx.stroke();
    if (p >= 1) {
      const tie = this.reduced ? 1 : KNOT(Math.max(0, Math.min(1, (now - this.t0 - DUR.slow) / DUR.base)));
      const s = (16 / 24) * (1.3 - 0.3 * tie);
      ctx.save();
      ctx.translate(x0 - 12 * s, y1 - 12 * s);
      ctx.scale(s, s);
      ctx.lineWidth = 2 / s * 1.5;
      ctx.strokeStyle = DEEP;
      ctx.globalAlpha = 0.3 + 0.7 * tie;
      ctx.stroke(KNOT_PATH);
      ctx.restore();
      if (tie >= 1) this.stop();
    }
  }
  private point(d: number, x0: number, y0: number, w: number, h: number): [number, number] {
    // clockwise from the bottom left corner (where the button sits), up the left edge first
    if (d <= h) return [x0, y0 + h - d];
    if (d <= h + w) return [x0 + (d - h), y0];
    if (d <= 2 * h + w) return [x0 + w, y0 + (d - h - w)];
    return [x0 + w - (d - 2 * h - w), y0 + h];
  }
}
export default function mount(root: HTMLElement) {
  return new SigninStitch(root);
}
