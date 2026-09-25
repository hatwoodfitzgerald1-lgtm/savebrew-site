// /your-moves scene (3.7, 7.10): the visitor's threads lifting out of the cloth in ranked order. Seven threads
// (one per candidate) lie flat in a woven field; when a toggle changes, the affected threads lift out of the
// cloth to the height of their new rank (Knot, 0.38s), the ranked four standing highest. The order arrives
// through the sb:rank event from src/scripts/ranker.ts; the editors' order at first paint comes from the
// ranker root's data-order. Reduced motion draws the current order at once.
// Root: <PageScene kind="moves-threads" height="160px" data-for="ranker" />
import { Scene } from './base';
import { KNOT, SHUTTLE, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const MUTED = '#4F5280';
const BUTTER = '#F6E7A1';
const BUTTER_DEEP = '#EBD77A';

interface Thread { id: string; x: number; lift: number; from: number; to: number; start: number; rank: number; phase: number; }

class MovesThreads extends Scene {
  threads: Thread[] = [];
  ids: string[] = [];
  top = 4;
  changedAt = 0;
  private onRank = (e: Event) => {
    const d = (e as CustomEvent).detail;
    const forId = this.root.dataset.for;
    if (forId && d.root && d.root.id !== forId) return;
    this.apply(d.order as string[], (d.top as string[]).length, d.on as number);
  };
  constructor(root: HTMLElement) {
    super(root);
    document.addEventListener('sb:rank', this.onRank);
    const ranker = document.getElementById(root.dataset.for || 'ranker');
    const order = (ranker?.dataset.order || '').split(' ').filter(Boolean);
    this.ids = order;
    this.threads = order.map((id, i) => ({ id, x: 0, lift: 0, from: 0, to: 0, start: 0, rank: i + 1, phase: i * 0.9 }));
    this.apply(order, 4, 0, true);
    this.resize();
  }
  /** rank 1 stands highest; ranks past the shown four lie in the cloth */
  private target(rank: number, on: number): number {
    if (rank > this.top) return on > 0 ? 0.08 : 0;
    return 1 - (rank - 1) * 0.18;
  }
  apply(order: string[], top: number, on: number, instant = false) {
    this.top = top;
    const now = performance.now();
    order.forEach((id, i) => {
      let th = this.threads.find((t) => t.id === id);
      if (!th) { th = { id, x: 0, lift: 0, from: 0, to: 0, start: 0, rank: i + 1, phase: i * 0.9 }; this.threads.push(th); }
      th.rank = i + 1;
      th.from = th.lift;
      th.to = this.target(th.rank, on);
      th.start = now;
      if (instant || this.reduced) th.lift = th.to;
    });
    this.changedAt = now;
    this.resize();
    if (!this.running && !this.reduced) this.start();
  }
  resize() {
    if (!this.ids) return; // the base class lays out before the fields exist
    // the threads keep their editorial x positions (the order they were authored in), spread across the width
    const n = Math.max(1, this.ids.length);
    this.ids.forEach((id, i) => {
      const th = this.threads.find((t) => t.id === id);
      if (th) th.x = ((i + 0.5) / n) * this.w;
    });
  }
  dispose() { document.removeEventListener('sb:rank', this.onRank); super.dispose(); }
  frame(now: number) {
    if (!this.threads) return;
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const clothTop = h * 0.62;
    // the woven field: faint warp and weft lines in pale butter, the cloth the threads lie in
    ctx.save();
    ctx.strokeStyle = BUTTER_DEEP;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    const step = 9;
    for (let y = clothTop; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    ctx.globalAlpha = 0.55;
    for (let x = 4; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, clothTop); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    ctx.restore();
    // the threads: each rises from the cloth by its lift (Knot on change), swaying a touch at idle
    let settled = true;
    for (const th of this.threads) {
      if (!this.reduced) {
        const raw = Math.min(1, (now - th.start) / DUR.base);
        if (raw < 1) settled = false;
        th.lift = th.from + (th.to - th.from) * KNOT(raw);
      } else th.lift = th.to;
      const lifted = th.rank <= this.top;
      const sway = this.reduced ? 0 : Math.sin(now / 3200 + th.phase) * 3 * th.lift;
      const topY = clothTop - th.lift * (clothTop - 14);
      const x = th.x + sway;
      ctx.lineCap = 'butt';
      ctx.lineWidth = lifted ? 2.5 : 2;
      ctx.strokeStyle = lifted ? INDIGO : MUTED;
      ctx.globalAlpha = lifted ? 1 : 0.55;
      // the thread from the foot of the cloth up to its knot
      ctx.beginPath();
      ctx.moveTo(th.x, h);
      ctx.bezierCurveTo(th.x, clothTop + 6, x, topY + 30, x, topY);
      ctx.stroke();
      // the knot at the thread's head: a small loop, butter flash as it lifts into the ranked four
      const flash = lifted && !this.reduced ? Math.max(0, 1 - (now - th.start) / (DUR.base * 1.4)) : 0;
      const r = lifted ? 5.5 + (this.top - th.rank) * 0.6 : 4;
      ctx.beginPath();
      ctx.arc(x, topY, r, 0, Math.PI * 2);
      ctx.fillStyle = flash > 0.5 ? BUTTER : lifted ? DEEP : MUTED;
      ctx.globalAlpha = lifted ? 1 : 0.55;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = lifted ? DEEP : MUTED;
      ctx.stroke();
      // the pass mark: a short weft tick through the knot for the ranked four
      if (lifted) {
        ctx.beginPath();
        ctx.moveTo(x - r - 5, topY);
        ctx.lineTo(x + r + 5, topY);
        ctx.strokeStyle = INDIGO;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // a weft line along the cloth's top edge, drawn in with Shuttle at load
    const edge = this.reduced ? 1 : SHUTTLE(Math.min(1, (now - this.changedAt + DUR.slow) / DUR.slow));
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, clothTop + 0.5);
    ctx.lineTo(w * Math.max(edge, 0.999), clothTop + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (settled && this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new MovesThreads(root);
}
