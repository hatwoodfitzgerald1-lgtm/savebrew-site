// /membership scene (3.7, 7.3): two threads plied into one cord (the Daily for Two). On load the two threads
// twist together along the band (Shuttle); hovering or focusing the Daily for Two card untwists them back into
// two, and they re ply on leave (Knot). Static and plied under reduced motion.
// Root: <PageScene kind="membership-ply" height="64px" data-card="daily-for-two" />
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';

class MembershipPly extends Scene {
  t0 = performance.now();
  ply = 0;          // 0 two threads apart, 1 fully plied
  target = 1;
  from = 0;
  changed = performance.now();
  private card: HTMLElement | null = null;
  private onEnter = () => this.untwist(true);
  private onLeave = () => this.untwist(false);
  constructor(root: HTMLElement) {
    super(root);
    this.card = document.getElementById(root.dataset.card || 'daily-for-two');
    if (this.card) {
      this.card.addEventListener('pointerenter', this.onEnter);
      this.card.addEventListener('pointerleave', this.onLeave);
      this.card.addEventListener('focusin', this.onEnter);
      this.card.addEventListener('focusout', this.onLeave);
    }
  }
  untwist(open: boolean) {
    const now = performance.now();
    this.from = this.ply;
    this.target = open ? 0 : 1;
    this.changed = now;
    if (this.reduced) { this.ply = 1; return; }
    if (!this.running) this.start();
  }
  resize() { /* nothing to lay out: the band is drawn from its width each frame */ }
  dispose() {
    if (this.card) {
      this.card.removeEventListener('pointerenter', this.onEnter);
      this.card.removeEventListener('pointerleave', this.onLeave);
      this.card.removeEventListener('focusin', this.onEnter);
      this.card.removeEventListener('focusout', this.onLeave);
    }
    super.dispose();
  }
  frame(now: number) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const mid = h / 2;
    const elapsed = now - this.t0;
    // the load ply: from two straight threads to the twisted cord over 1.2s (Shuttle); later changes on Knot
    if (this.reduced) this.ply = 1;
    else if (elapsed < DUR.slow && this.changed === this.t0) this.ply = SHUTTLE(elapsed / DUR.slow);
    else if (this.changed !== this.t0) this.ply = this.from + (this.target - this.from) * KNOT(Math.min(1, (now - this.changed) / DUR.base));
    else this.ply = 1;
    const creep = this.reduced ? 0 : (now / DUR.idle) * Math.PI * 2;
    const amp = (h * 0.28) * this.ply;          // how far each thread swings around the cord's axis
    const apart = (h * 0.22) * (1 - this.ply);   // the gap between the two threads when unplied
    const period = Math.max(48, w / 22);
    const draw = (phase: number, color: string, width: number, offset: number) => {
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.lineCap = 'butt';
      for (let x = 0; x <= w; x += 3) {
        const y = mid + offset + Math.sin((x / period) * Math.PI * 2 + phase + creep) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    // the two threads, one deep and one indigo, drawn twice so the over and under crossings read as a real ply
    ctx.globalAlpha = 1;
    draw(0, INDIGO, 2.5, -apart);
    draw(Math.PI, DEEP, 2.5, apart);
    // the over crossings: redraw the front halves of each thread where it passes in front
    ctx.globalAlpha = 0.9;
    for (let x = 0; x <= w; x += 3) {
      const s = Math.sin((x / period) * Math.PI * 2 + creep);
      const c = Math.cos((x / period) * Math.PI * 2 + creep);
      if (c > 0 && this.ply > 0.05) {
        const y = mid - apart + s * amp;
        ctx.fillStyle = INDIGO;
        ctx.fillRect(x - 1.5, y - 1.25, 3, 2.5);
      }
    }
    ctx.globalAlpha = 1;
    if (this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new MembershipPly(root);
}
