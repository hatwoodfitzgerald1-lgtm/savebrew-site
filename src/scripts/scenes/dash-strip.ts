// The dashboard's tab indicator (design document 7.16 to 7.19, "Scene and hover"): the thread strip drawn on one
// small canvas in the app bar. Each tab has a short thread along the foot of the bar; the active tab's thread
// is pulled taut in indigo with its knot, the others hang slack; hovering or focusing a tab pulls its thread
// tight (Knot). Per view, the active thread carries a small flourish: today's five knots on /today, the Rates
// thread rising through its knot on /rates, the Goals knot filling on /goals, three stacked weft rows on /archive.
// Reduced motion draws the end state. Root: [data-scene="dash-strip"] appended to the bar's .tabs nav.
import { Scene } from './base';
import { KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const PALE = 'rgba(43, 47, 143, 0.35)';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');

interface Tab { el: HTMLElement; x0: number; x1: number; active: boolean; tight: number; sag: number }

class DashStrip extends Scene {
  t0 = performance.now();
  tabs: Tab[] = [];
  hovered: HTMLElement | null = null;
  view = 'today';
  private onEnter = (e: Event) => { this.hovered = (e.target as HTMLElement).closest('.tab'); this.start(); };
  private onLeave = () => { this.hovered = null; this.start(); };
  constructor(root: HTMLElement) {
    super(root);
    this.view = root.dataset.view || 'today';
    const nav = root.parentElement!;
    nav.addEventListener('pointerover', this.onEnter);
    nav.addEventListener('pointerout', this.onLeave);
    nav.addEventListener('focusin', this.onEnter);
    nav.addEventListener('focusout', this.onLeave);
    this.resize();
  }
  resize() {
    const nav = this.root.parentElement;
    if (!nav) return;
    const r0 = this.root.getBoundingClientRect();
    this.tabs = Array.from(nav.querySelectorAll<HTMLElement>('.tab')).map((el) => {
      const r = el.getBoundingClientRect();
      const prev = this.tabs?.find((t) => t.el === el);
      return { el, x0: r.left - r0.left + 12, x1: r.right - r0.left - 12, active: el.getAttribute('aria-current') === 'page', tight: prev ? prev.tight : (el.getAttribute('aria-current') === 'page' ? 1 : 0), sag: prev ? prev.sag : 2 + Math.random() * 2 };
    });
  }
  frame(now: number, dt: number) {
    if (!this.tabs) return;
    const ctx = this.ctx;
    const y = this.h - 3;
    const elapsed = now - this.t0;
    let moving = false;
    for (const t of this.tabs) {
      const want = t.active || t.el === this.hovered ? 1 : 0;
      const step = this.reduced ? 1 : Math.min(1, dt / DUR.base);
      if (Math.abs(t.tight - want) > 0.001) { t.tight += (want - t.tight) * (this.reduced ? 1 : step * 2.2); moving = true; }
      const k = KNOT(Math.max(0, Math.min(1, t.tight)));
      const sag = t.sag * (1 - k);
      ctx.lineCap = 'butt';
      ctx.lineWidth = 2;
      ctx.strokeStyle = t.active || k > 0.5 ? INDIGO : PALE;
      ctx.beginPath();
      ctx.moveTo(t.x0, y);
      ctx.quadraticCurveTo((t.x0 + t.x1) / 2, y + sag, t.x1, y);
      ctx.stroke();
      if (t.active) this.flourish(ctx, t, y, elapsed);
    }
    if (!moving && (this.reduced || elapsed > DUR.slow * 2)) this.stop();
  }
  private knot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha = 1) {
    ctx.save();
    ctx.translate(x - 12 * s, y - 12 * s);
    ctx.scale(s, s);
    ctx.lineWidth = 2 / s * 1.4;
    ctx.strokeStyle = DEEP;
    ctx.globalAlpha = alpha;
    ctx.stroke(KNOT_PATH);
    ctx.restore();
  }
  private flourish(ctx: CanvasRenderingContext2D, t: Tab, y: number, elapsed: number) {
    const p = this.reduced ? 1 : Math.min(1, elapsed / DUR.slow);
    const mid = (t.x0 + t.x1) / 2;
    if (this.view === 'today') {
      // today's five knots tie along the taut thread, one after another
      for (let i = 0; i < 5; i++) {
        const q = this.reduced ? 1 : KNOT(Math.max(0, Math.min(1, (elapsed - i * 120) / DUR.base)));
        if (q <= 0) continue;
        this.knot(ctx, t.x0 + ((t.x1 - t.x0) * (i + 0.5)) / 5, y, (10 / 24) * (1.3 - 0.3 * q), 0.4 + 0.6 * q);
      }
    } else if (this.view === 'rates') {
      // the Rates thread rises through its knot
      const rise = KNOT(p);
      ctx.strokeStyle = INDIGO; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mid, y); ctx.lineTo(mid, y - 14 * rise); ctx.stroke();
      this.knot(ctx, mid, y - 7 * rise, 10 / 24, 0.5 + 0.5 * rise);
    } else if (this.view === 'goals') {
      // the Goals knot fills as the featured goal's bar fills
      this.knot(ctx, mid, y, 11 / 24);
      ctx.fillStyle = INDIGO; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(mid, y, 3.2 * KNOT(p), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // three stacked weft rows draw in
      ctx.strokeStyle = INDIGO; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const q = this.reduced ? 1 : Math.max(0, Math.min(1, (elapsed - i * 150) / DUR.base));
        if (q <= 0) continue;
        const yy = y - 5 - i * 5;
        ctx.globalAlpha = 0.35 + 0.65 * q;
        ctx.beginPath(); ctx.moveTo(mid - 10, yy); ctx.lineTo(mid - 10 + 20 * q, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
export default function mount(root: HTMLElement) {
  return new DashStrip(root);
}
