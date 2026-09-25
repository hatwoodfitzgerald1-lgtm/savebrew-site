// /roundup scene (3.7, 7.4): one thread with three knots that the camera tracks along as the three moves are
// read. The band sits at the head of the moves row; the thread pans slowly with the reading (the 2D camera
// tracking along it) and each knot tightens as its move enters the viewport (Knot); the thread creeps on the
// idle cadence. Static and knotted under reduced motion.
// Root: <PageScene kind="roundup-thread" height="64px" data-moves="roundup-moves" data-items=".ru-move" data-stops="0.2,0.5,0.8" />
import { Scene } from './base';
import { KNOT, SHUTTLE, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const BUTTER = '#F6E7A1';

class RoundupThread extends Scene {
  t0 = performance.now();
  stops: number[] = [0.2, 0.5, 0.8];
  tied: number[] = [];
  tieAt: number[] = [];
  moves: HTMLElement[] = [];
  private io?: IntersectionObserver;
  constructor(root: HTMLElement) {
    super(root);
    this.stops = (root.dataset.stops || '0.2,0.5,0.8').split(',').map(Number);
    this.tied = this.stops.map(() => 0);
    this.tieAt = this.stops.map(() => 0);
    const board = document.getElementById(root.dataset.moves || 'roundup-moves');
    this.moves = board ? Array.from(board.querySelectorAll<HTMLElement>(root.dataset.items || '[data-move]')) : [];
    if (this.reduced) { this.tieAt = this.stops.map(() => 1); return; }
    // each knot ties as its move enters the viewport
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = this.moves.indexOf(e.target as HTMLElement);
        if (i >= 0 && !this.tieAt[i]) { this.tieAt[i] = performance.now(); if (!this.running) this.start(); }
      }
    }, { threshold: 0.35 });
    this.moves.forEach((m) => this.io!.observe(m));
  }
  resize() { /* drawn from the width each frame */ }
  dispose() { this.io?.disconnect(); super.dispose(); }
  frame(now: number) {
    if (!this.stops) return;
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const y = h / 2;
    const elapsed = now - this.t0;
    // the camera tracks along the thread: the thread's texture (small weft ticks) pans with reading progress and creeps at idle
    const p = this.progress();
    const pan = this.reduced ? 0 : (p * 80 + (now / DUR.idle) * 40) % 24;
    const draw = this.reduced ? 1 : SHUTTLE(Math.min(1, elapsed / DUR.slow));
    ctx.lineCap = 'butt';
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w * draw, y);
    ctx.stroke();
    // the fibre ticks along the thread, panning
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let x = -pan; x < w * draw; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 6, y + 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the three knots, each tightening (1.18 to 1 on Knot) once its move is in view, with a short butter flash
    this.stops.forEach((s, i) => {
      const x = w * s;
      if (draw < s) return;
      const at = this.tieAt[i];
      const tie = this.reduced ? 1 : at ? KNOT(Math.min(1, (now - at) / DUR.base)) : 0;
      const scale = 1.18 - 0.18 * tie;
      const r = 6 * scale;
      // the loop
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
      ctx.strokeStyle = tie > 0 ? DEEP : INDIGO;
      ctx.lineWidth = 2;
      ctx.globalAlpha = tie > 0 ? 1 : 0.45;
      ctx.stroke();
      // the warp stub through it
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
      // the centre pulls tight
      const flash = at && !this.reduced ? Math.max(0, 1 - (now - at) / (DUR.base * 0.5)) : 0;
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * (tie || 0.4), 0, Math.PI * 2);
      ctx.fillStyle = flash > 0.4 ? BUTTER : DEEP;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new RoundupThread(root);
}
