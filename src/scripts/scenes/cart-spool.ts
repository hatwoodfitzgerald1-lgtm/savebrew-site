// The cart scene (3.7, 6.5): the knot slides along a thread into the spool glyph. One thread runs from the
// left edge to a spool drawn at the right in the kit's icon language; the knot travels along it (Shuttle),
// pulls tight as it reaches the spool (Knot) and the spool takes one more turn of thread. It replays each
// time the drawer opens or a membership is added; idle, the thread sags on a slow cycle. Reduced motion draws
// the knot already on the spool. Root: [data-scene="cart-spool"] in the drawer and on /cart.
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const BUTTER = '#EBD77A';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

class CartSpool extends Scene {
  t0 = performance.now();
  empty = false;
  private onReplay = () => { this.t0 = performance.now(); this.start(); };
  private onCart = (e: any) => { this.empty = !e.detail; this.onReplay(); };
  constructor(root: HTMLElement) {
    super(root);
    document.addEventListener('sb:cart-open', this.onReplay);
    document.addEventListener('sb:cart-add', this.onReplay);
    document.addEventListener('sb:cart', this.onCart);
    const w = (window as any).sbCart;
    if (w && typeof w.get === 'function') this.empty = !w.get();
  }
  dispose() {
    super.dispose();
    document.removeEventListener('sb:cart-open', this.onReplay);
    document.removeEventListener('sb:cart-add', this.onReplay);
    document.removeEventListener('sb:cart', this.onCart);
  }
  resize() {}
  frame(now: number) {
    if (this.t0 == null) return;   // the base class draws once before the fields above exist
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const y = h * 0.56;
    const spoolW = Math.min(44, h * 0.7), spoolH = Math.min(40, h * 0.62);
    const sx = w - spoolW - 8;          // the spool's left edge
    const elapsed = now - this.t0;
    // travel along the thread over 1.2s (Shuttle), then the knot pulls tight over 0.38s (Knot)
    const travel = this.reduced ? 1 : SHUTTLE(Math.min(1, elapsed / DUR.slow));
    const tie = this.reduced ? 1 : KNOT(Math.max(0, Math.min(1, (elapsed - DUR.slow) / DUR.base)));
    const sway = this.reduced ? 0 : Math.sin((now / 7000) * Math.PI * 2) * 3;
    const startX = 12;
    const endX = sx - 10;
    const kx = this.empty ? startX : startX + (endX - startX) * travel;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 2;
    // the thread, slack behind the knot and taut ahead of it
    ctx.strokeStyle = INDIGO;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(kx * 0.5, y + sway * (1 - travel) + 4 * (1 - travel), kx, y);
    ctx.stroke();
    ctx.globalAlpha = this.empty ? 0.35 : 0.35 + 0.65 * travel;
    ctx.beginPath();
    ctx.moveTo(kx, y);
    ctx.lineTo(sx + 2, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // the spool (the kit's spool glyph): two flanges, the winding, a tail
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 1.75;
    const top = y - spoolH / 2, bot = y + spoolH / 2;
    ctx.beginPath();
    ctx.moveTo(sx, top); ctx.lineTo(sx + spoolW, top);
    ctx.moveTo(sx, bot); ctx.lineTo(sx + spoolW, bot);
    ctx.moveTo(sx + spoolW * 0.2, top); ctx.lineTo(sx + spoolW * 0.2, bot);
    ctx.moveTo(sx + spoolW * 0.8, top); ctx.lineTo(sx + spoolW * 0.8, bot);
    ctx.stroke();
    // the winding: three turns, plus one more that arrives with the knot
    const turns = 3 + (this.empty ? 0 : tie);
    ctx.beginPath();
    for (let i = 0; i < Math.ceil(turns); i++) {
      const p = Math.min(1, turns - i);
      const ty = top + spoolH * (0.28 + 0.15 * i);
      ctx.moveTo(sx + spoolW * 0.2, ty);
      ctx.lineTo(sx + spoolW * 0.2 + spoolW * 0.6 * p, ty + 2 * p);
    }
    ctx.stroke();
    ctx.strokeStyle = BUTTER;
    ctx.beginPath(); ctx.moveTo(sx + spoolW * 0.8, y + spoolH * 0.2); ctx.lineTo(sx + spoolW + 6, y + spoolH * 0.32); ctx.stroke();
    if (this.empty) return;
    // the knot, scaling from loose to tight as it arrives (the overshoot comes from the Knot curve)
    const s = (h * 0.42) / 24 * (1.25 - 0.25 * tie);
    ctx.save();
    ctx.translate(kx - 12 * s, y - 12 * s);
    ctx.scale(s, s);
    ctx.lineWidth = 2 / s * 1.6;
    ctx.strokeStyle = DEEP;
    ctx.stroke(KNOT_PATH);
    ctx.restore();
    if (travel >= 1 && tie >= 1 && this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new CartSpool(root);
}
