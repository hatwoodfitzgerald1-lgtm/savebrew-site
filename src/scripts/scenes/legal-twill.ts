// /terms and /privacy scene (design document 7.21): the twill as the page's margins, drawn once on a canvas at
// load with its diagonal crossings filling in over 1.2s (Shuttle) from the top left, then still. Reduced motion
// draws the whole field at once. Root: [data-scene="legal-twill"], the full band behind the legal text.
import { Scene } from './base';
import { SHUTTLE, DUR } from '../ease';

const BUTTER = '#F6E7A1';
const LIGHT = 'rgba(255, 255, 255, 0.30)';
const DARK = 'rgba(43, 47, 143, 0.06)';
const PITCH = 8, THREAD = 6;

class LegalTwill extends Scene {
  t0 = performance.now();
  drawn = -1;      // the diagonal index the field has been filled to
  resize() { this.drawn = -1; }
  frame(now: number) {
    if (this.t0 == null) return;
    const ctx = this.ctx;
    const cols = Math.ceil(this.w / PITCH), rows = Math.ceil(this.h / PITCH);
    const total = cols + rows;
    const p = this.reduced ? 1 : SHUTTLE(Math.min(1, (now - this.t0) / DUR.slow));
    const upTo = Math.floor(total * p);
    if (this.drawn < 0) { ctx.fillStyle = BUTTER; ctx.fillRect(0, 0, this.w, this.h); }
    // only the new diagonals are painted each frame; the base class clears first, so repaint the ground each time
    if (this.drawn >= 0) { ctx.fillStyle = BUTTER; ctx.fillRect(0, 0, this.w, this.h); }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (i + j > upTo) continue;
        const x = i * PITCH, y = j * PITCH;
        const weftOver = ((i + j) % 4) < 2;
        ctx.fillStyle = weftOver ? LIGHT : DARK;
        ctx.fillRect(x + 1, y + 1, THREAD, THREAD);
        ctx.fillStyle = weftOver ? DARK : LIGHT;
        if (weftOver) ctx.fillRect(x + 1, y + 1, THREAD, 2); else ctx.fillRect(x + 1, y + 1, 2, THREAD);
      }
    }
    this.drawn = upTo;
    if (p >= 1) this.stop();
  }
}
export default function mount(root: HTMLElement) {
  return new LegalTwill(root);
}
