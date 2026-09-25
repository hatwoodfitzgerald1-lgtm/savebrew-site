// /brief scene (3.7, 7.2): one weft thread weaves the day's five knots across the page head. The thread
// passes left to right along the band and ties a knot at each of the five column centres in turn (Shuttle
// for the pass, Knot for each tie), then creeps on the 11s idle cadence; static and fully knotted under
// reduced motion. Root: <PageScene kind="brief-weft" height="64px" /> at the head of the items board.
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const PALE = '#EBD77A';
const KNOTS = 5;

class BriefWeft extends Scene {
  t0 = performance.now();
  columns = 1;
  resize() { this.columns = Number(this.root.dataset.columns || KNOTS) || KNOTS; }
  private knotX(i: number): number {
    // five knots at the five column centres (one column on phones: spread evenly)
    const n = this.columns >= KNOTS ? KNOTS : KNOTS;
    return ((i + 0.5) / n) * this.w;
  }
  frame(now: number) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const y = h / 2;
    const elapsed = now - this.t0;
    const passMs = DUR.slow * 1.6;
    // the weft's head travels the width once (Shuttle), then the thread creeps on the idle cadence
    const pass = this.reduced ? 1 : SHUTTLE(Math.min(1, elapsed / passMs));
    const creep = this.reduced ? 0 : Math.sin((now / DUR.idle) * Math.PI * 2) * 1.5;
    // the warp stubs: five short vertical threads the weft crosses, faint until knotted
    for (let i = 0; i < KNOTS; i++) {
      const x = this.knotX(i);
      const tied = this.tieAmount(i, pass, elapsed);
      ctx.strokeStyle = tied > 0 ? INDIGO : PALE;
      ctx.lineWidth = 2;
      ctx.globalAlpha = tied > 0 ? 0.55 + 0.45 * tied : 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the weft thread from the left edge to its head, with a slight sag between knots
    const headX = w * pass;
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, y + creep);
    const seg = w / (KNOTS * 2);
    for (let x = seg; x <= headX + 0.5; x += seg) {
      const sag = (Math.floor(x / seg) % 2 === 0 ? 2.5 : -2.5) * (1 - pass * 0.6);
      ctx.quadraticCurveTo(x - seg / 2, y + sag + creep, Math.min(x, headX), y + creep);
    }
    ctx.lineTo(headX, y + creep);
    ctx.stroke();
    // the knots: each ties as the head passes it (the loop scales from 1.18 to 1 on Knot)
    for (let i = 0; i < KNOTS; i++) {
      const x = this.knotX(i);
      const tie = this.tieAmount(i, pass, elapsed);
      if (tie <= 0) continue;
      const s = 1.18 - 0.18 * tie;
      const r = 5 * s;
      ctx.beginPath();
      ctx.ellipse(x, y + creep, r * 1.35, r, 0, 0, Math.PI * 2);
      ctx.strokeStyle = DEEP;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3 + 0.7 * tie;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + creep, 2.2 * tie, 0, Math.PI * 2);
      ctx.fillStyle = DEEP;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.reduced) return;
  }
  /** 0 before the weft reaches knot i, 1 once tied (Knot easing over 0.38s from the moment the head passes) */
  private tieAmount(i: number, pass: number, elapsed: number): number {
    if (this.reduced) return 1;
    const at = (i + 0.5) / KNOTS;
    if (pass < at) return 0;
    // when did the head pass this knot? invert the Shuttle curve by search over elapsed time
    const passMs = DUR.slow * 1.6;
    let lo = 0, hi = passMs;
    for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (SHUTTLE(mid / passMs) < at) lo = mid; else hi = mid; }
    return KNOT(Math.min(1, (elapsed - hi) / DUR.base));
  }
}
export default function mount(root: HTMLElement) {
  return new BriefWeft(root);
}
