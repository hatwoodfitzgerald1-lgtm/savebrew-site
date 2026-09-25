// The guides family scene (3.7, 7.5 to 7.9): a spool that unwinds a thread as reading progress. The band sits
// at the head of the body: the spool at the left end, the thread unwound across the band by the reading
// fraction of the element named in data-progress (the body board, or the page), the thread's head marked by a
// knot. Each post lays its own figure along the thread (data-figure):
//   loop           one thread loops back on itself once; the loop closes as the reader passes the cap arithmetic
//   two-threads    a thin pale thread (0.37) beside a thick indigo one (4.00) that draws with the reading
//   tape           a woven tape edge with tick knots that tie at $1, $37, $100, $350 and $400 as the reader reaches them
//   twelve-knots   twelve knots at even intervals, January to December, tying as the reader passes each month; October flashes butter
//   (none)         the index: the spool and the thread only
// Static, fully unwound and tied, under reduced motion. The thread creeps on the idle cadence.
// Root: <PageScene kind="guide-spool" height="72px" data-progress="guide-body" data-figure="loop" />
import { Scene } from './base';
import { KNOT, SHUTTLE, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const DEEP = '#1B1E5C';
const PALE = '#EBD77A';
const BUTTER = '#F6E7A1';

class GuideSpool extends Scene {
  t0 = performance.now();
  figure = '';
  target: HTMLElement | null = null;
  tieAt: number[] = [];
  smooth = 0;
  resize() { this.figure = this.root.dataset.figure || ''; this.target = document.getElementById(this.root.dataset.progress || '') || null; }
  /** the reading fraction of the target: 0 at its top reaching the viewport's lower third, 1 at its foot passing it */
  private reading(): number {
    if (this.reduced) return 1;
    const el = this.target;
    if (!el) return Math.max(0, Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
    const r = el.getBoundingClientRect();
    const line = innerHeight * 0.66;
    return Math.max(0, Math.min(1, (line - r.top) / Math.max(1, r.height)));
  }
  frame(now: number) {
    if (!this.tieAt) return;
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const y = h / 2;
    const elapsed = now - this.t0;
    const load = this.reduced ? 1 : SHUTTLE(Math.min(1, elapsed / DUR.slow));
    const raw = this.reading();
    // the unwinding follows the reading with a little lag (Shuttle-like smoothing) so it reads as a spool giving thread
    this.smooth = this.reduced ? raw : this.smooth + (raw - this.smooth) * 0.12;
    const p = Math.max(0.02, this.smooth) * load;
    const creep = this.reduced ? 0 : Math.sin((now / DUR.idle) * Math.PI * 2) * 2;
    const spoolW = 22, spoolH = 34;
    const sx = 2, sy = y - spoolH / 2;
    // the spool: two flanges, the wound thread (thinner as it unwinds), in the kit's square capped line
    ctx.lineCap = 'butt';
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx + spoolW, sy);
    ctx.moveTo(sx, sy + spoolH); ctx.lineTo(sx + spoolW, sy + spoolH);
    ctx.moveTo(sx + 3, sy); ctx.lineTo(sx + 3, sy + spoolH);
    ctx.moveTo(sx + spoolW - 3, sy); ctx.lineTo(sx + spoolW - 3, sy + spoolH);
    ctx.stroke();
    const wound = 1 - p * 0.7;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const yy = sy + 6 + i * 4.2;
      const inset = 4 + (1 - wound) * 5;
      ctx.beginPath(); ctx.moveTo(sx + inset, yy); ctx.lineTo(sx + spoolW - inset, yy + 1.2); ctx.stroke();
    }
    // the unwound thread, from the spool's edge to the reading head
    const x0 = sx + spoolW + 4;
    const x1 = x0 + (w - x0 - 10) * p;
    ctx.lineWidth = 2;
    ctx.strokeStyle = INDIGO;
    if (this.figure === 'loop') this.drawLoop(x0, x1, y, creep, p, now);
    else if (this.figure === 'two-threads') this.drawTwo(x0, x1, y, creep, p);
    else if (this.figure === 'tape') this.drawTape(x0, x1, y, creep, p, now, w);
    else if (this.figure === 'twelve-knots') this.drawTwelve(x0, x1, y, creep, p, now, w);
    else { ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 4 + creep, x1, y); ctx.stroke(); }
    // the reading head: a small knot that pulls tight at the end of the body
    const tight = p > 0.985 ? 1 : 0;
    ctx.beginPath();
    ctx.ellipse(x1, y, 6 - tight, 4.5 - tight * 0.6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = DEEP;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x1, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = DEEP;
    ctx.fill();
    if (this.reduced) return;
  }
  private drawLoop(x0: number, x1: number, y: number, creep: number, p: number, now: number) {
    const ctx = this.ctx;
    const w = this.w;
    const lx = x0 + (w - x0) * 0.5;      // the loop sits at the middle of the band (the cap arithmetic)
    const closing = KNOT(Math.max(0, Math.min(1, (p - 0.45) / 0.15)));  // the loop closes as the reader passes the middle
    const r = 16 - 9 * closing;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    if (x1 < lx - r) { ctx.quadraticCurveTo((x0 + x1) / 2, y + 3 + creep, x1, y); ctx.stroke(); return; }
    ctx.lineTo(lx - r, y);
    // the loop: over the top and back under itself once
    ctx.bezierCurveTo(lx - r, y - r * 2.2, lx + r, y - r * 2.2, lx + r, y);
    ctx.bezierCurveTo(lx + r, y + r * 0.9, lx - r * 0.2, y + r * 0.9, lx - r * 0.3, y + 2);
    ctx.moveTo(lx + r * 0.2, y + 1);
    ctx.quadraticCurveTo((lx + r + x1) / 2, y + 3 + creep, x1, y);
    ctx.stroke();
    void now;
  }
  private drawTwo(x0: number, x1: number, y: number, creep: number, p: number) {
    const ctx = this.ctx;
    // the thin pale thread (0.37 percent) stays a hair's width and a hair's length beside the thick indigo one (4.00)
    ctx.strokeStyle = PALE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y + 10);
    ctx.lineTo(x0 + (x1 - x0) * 0.0925 + 4, y + 10);
    ctx.stroke();
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y - 4);
    ctx.quadraticCurveTo((x0 + x1) / 2, y - 4 + 3 + creep, x1, y - 4);
    ctx.stroke();
    ctx.lineWidth = 2;
    void p;
  }
  private drawTape(x0: number, x1: number, y: number, creep: number, p: number, now: number, w: number) {
    const ctx = this.ctx;
    // the woven tape edge: a double thread with short weft ticks
    ctx.beginPath();
    ctx.moveTo(x0, y - 5); ctx.lineTo(x1, y - 5);
    ctx.moveTo(x0, y + 5); ctx.lineTo(x1, y + 5);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    for (let x = x0 + 6; x < x1; x += 8) { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 3, y + 5); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // the tick knots at the figures: $1, $37, $100, $350 and $400 along the tape (their places in the body)
    const stops = [0.12, 0.3, 0.5, 0.72, 0.9];
    stops.forEach((s, i) => {
      const x = x0 + (w - x0 - 10) * s;
      const reached = p >= s;
      if (reached && !this.tieAt[i]) this.tieAt[i] = now;
      const tie = this.reduced ? 1 : reached ? KNOT(Math.min(1, (now - (this.tieAt[i] || now)) / DUR.base)) : 0;
      ctx.beginPath();
      ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
      ctx.strokeStyle = reached ? DEEP : PALE;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (tie > 0) {
        ctx.beginPath();
        ctx.arc(x, y, 4 * (1.18 - 0.18 * tie), 0, Math.PI * 2);
        ctx.fillStyle = DEEP;
        ctx.fill();
      }
    });
    ctx.strokeStyle = INDIGO;
    void creep;
  }
  private drawTwelve(x0: number, x1: number, y: number, creep: number, p: number, now: number, w: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + 3 + creep, x1, y);
    ctx.stroke();
    for (let m = 0; m < 12; m++) {
      const s = (m + 0.5) / 12;
      const x = x0 + (w - x0 - 10) * s;
      const reached = p >= s;
      if (reached && !this.tieAt[m]) this.tieAt[m] = now;
      const tie = this.reduced ? 1 : reached ? KNOT(Math.min(1, (now - (this.tieAt[m] || now)) / DUR.base)) : 0;
      const flash = m === 9 && reached && !this.reduced ? Math.max(0, 1 - (now - (this.tieAt[m] || now)) / 90) : 0;
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
      ctx.strokeStyle = reached ? DEEP : PALE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, 5 * (1.18 - 0.18 * tie) * (tie ? 1 : 0.6), 3.6 * (tie ? 1 : 0.6), 0, 0, Math.PI * 2);
      ctx.strokeStyle = reached ? DEEP : PALE;
      ctx.fillStyle = flash > 0 ? BUTTER : m === 9 && tie ? BUTTER : 'transparent';
      if (flash > 0 || (m === 9 && tie)) ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = INDIGO;
  }
}
export default function mount(root: HTMLElement) {
  return new GuideSpool(root);
}
