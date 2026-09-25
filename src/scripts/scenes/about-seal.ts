// /about scene (3.7, 7.11): the Selvedge Seal being woven row by row beside the copy. Eleven warp threads
// crossed by eleven weft rows drawn as a real over and under weave, the S and B forming from which crossings
// are indigo and which are butter (the kit's own crossing map), each row woven in as the visitor reads the body
// (Shuttle per row), the running stitch border last (Knot). Static and complete under reduced motion.
// Root: <PageScene kind="about-seal" height="100%" data-progress="about-body" />
import { Scene } from './base';
import { SHUTTLE, KNOT, DUR } from '../ease';

const INDIGO = '#2B2F8F';
const BUTTER = '#F6E7A1';
const WHITE = '#FFFFFF';
// the kit seal's crossing map: 1 where the warp passes over the weft (indigo), 0 where the weft shows (butter)
const MAP = ['10101010101', '00000000000', '01111011110', '10000010001', '10000010001', '01110011110', '00001010001', '00001010001', '11110011110', '00000000000', '10101010101'].map((r) => r.split('').map(Number));
const N = 11;

class AboutSeal extends Scene {
  target: HTMLElement | null = null;
  rowAt: number[] = [];
  borderAt = 0;
  smooth = 0;
  resize() { this.target = document.getElementById(this.root.dataset.progress || '') || null; }
  private reading(): number {
    if (this.reduced) return 1;
    const el = this.target;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    const line = innerHeight * 0.75;
    return Math.max(0, Math.min(1, (line - r.top) / Math.max(1, r.height * 0.9)));
  }
  frame(now: number) {
    if (!this.rowAt) return;
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const size = Math.min(w, h, 320);
    const ox = (w - size) / 2, oy = 0;
    const s = size / 160;
    const raw = this.reading();
    this.smooth = this.reduced ? raw : this.smooth + (raw - this.smooth) * 0.1;
    // rows weave in as the reading fraction passes each eleventh; the border after the last row
    const rowsDue = this.reduced ? N : Math.min(N, Math.floor(this.smooth * (N + 1)));
    for (let i = 0; i < rowsDue; i++) if (!this.rowAt[i]) this.rowAt[i] = now;
    if (rowsDue >= N && !this.borderAt) this.borderAt = now;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    // the card
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.roundRect(1, 1, 158, 158, 8); ctx.fill();
    // the warp threads, always present (slack and pale until woven)
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = INDIGO;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(15 + c * 12, 12, 10, 136);
    }
    ctx.globalAlpha = 1;
    // the weft rows: each slides in from the left (Shuttle) and the row's over crossings land on it
    for (let r = 0; r < N; r++) {
      const at = this.rowAt[r];
      if (!at) continue;
      const k = this.reduced ? 1 : SHUTTLE(Math.min(1, (now - at) / DUR.base));
      const dx = -8 * (1 - k);
      ctx.globalAlpha = k;
      ctx.fillStyle = BUTTER;
      ctx.fillRect(12 + dx, 15 + r * 12, 136, 10);
      ctx.fillStyle = INDIGO;
      for (let c = 0; c < N; c++) if (MAP[r][c]) ctx.fillRect(15 + c * 12 + dx, 14 + r * 12, 10, 12);
      ctx.globalAlpha = 1;
    }
    // the running stitch border, drawn last around the seal (Knot)
    if (this.borderAt) {
      const k = this.reduced ? 1 : KNOT(Math.min(1, (now - this.borderAt) / DUR.slow));
      ctx.strokeStyle = INDIGO;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = 600 * (1 - k);
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.beginPath(); ctx.roundRect(6, 6, 148, 148, 6);
      // draw only the woven fraction of the perimeter
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 160, 160 * Math.max(k, 0.02) + 0);
      ctx.clip();
      ctx.beginPath(); ctx.roundRect(6, 6, 148, 148, 6); ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (this.reduced) return;
  }
}
export default function mount(root: HTMLElement) {
  return new AboutSeal(root);
}
