// The three generative surfaces (3.16): the Selvedge (a procedural running stitch, seeded per section),
// the Twill (a diagonal weave field at 6 percent contrast, tiled) and the Thread Strip (five short vertical
// threads with per load sag). All three respect data-motion="reduced", prefers-reduced-motion and ?qa=rm
// by rendering their static end states.
import { SHUTTLE, DUR, motionReduced, tween } from './ease';
// @ts-ignore plain JS shared with the build script
import { drawTwill } from './twill-tile.js';

const INDIGO = '#2B2F8F';
const DPR = () => Math.min(1.5, window.devicePixelRatio || 1);

/** A deterministic PRNG from a string seed (mulberry32 over an FNV hash). */
export function rng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function size(canvas: HTMLCanvasElement): { w: number; h: number; ctx: CanvasRenderingContext2D } {
  const dpr = DPR();
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}

// ------------------------------------------------------------------ THE SELVEDGE
export interface SelvedgeOptions { orientation?: 'horizontal' | 'vertical'; color?: string; stitch?: number; gap?: number; width?: number; }
export interface SelvedgeHandle { draw: (progress: number) => void; tieOff: (progress?: number) => void; resize: () => void; }
/** Draws the running stitch along the canvas (stitch 6, gap 4, 2px, per instance jitter from the seed). draw(progress) draws that fraction of the length. */
export function selvedge(canvas: HTMLCanvasElement, seed: string, opts: SelvedgeOptions = {}): SelvedgeHandle {
  const orientation = opts.orientation || 'horizontal';
  const color = opts.color || INDIGO;
  const stitchLen = opts.stitch ?? 6;
  const gapLen = opts.gap ?? 4;
  const lineW = opts.width ?? 2;
  let last = 1;
  let knot = -1;
  const draw = (progress: number) => {
    last = progress;
    const { w, h, ctx } = size(canvas);
    ctx.clearRect(0, 0, w, h);
    const rand = rng(seed);
    const length = orientation === 'horizontal' ? w : h;
    const mid = orientation === 'horizontal' ? h / 2 : w / 2;
    const limit = length * Math.max(0, Math.min(1, progress));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'butt';
    let pos = 2;
    ctx.beginPath();
    while (pos < limit) {
      const len = stitchLen + (rand() - 0.5) * 1.6;
      const angle = (rand() - 0.5) * 0.06;     // about 1.7 degrees of jitter
      const drift = (rand() - 0.5) * 0.8;
      const end = Math.min(limit, pos + len);
      if (orientation === 'horizontal') {
        ctx.moveTo(pos, mid + drift);
        ctx.lineTo(end, mid + drift + Math.tan(angle) * (end - pos));
      } else {
        ctx.moveTo(mid + drift, pos);
        ctx.lineTo(mid + drift + Math.tan(angle) * (end - pos), end);
      }
      pos += len + gapLen + (rand() - 0.5) * 1.2;
    }
    ctx.stroke();
    if (knot >= 0) drawKnot(ctx, orientation === 'horizontal' ? length * knot : mid, orientation === 'horizontal' ? mid : length * knot, color);
  };
  const tieOff = (at = 1) => { knot = at; draw(last); };
  const resize = () => draw(last);
  return { draw, tieOff, resize };
}
function drawKnot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  // the knot glyph, a small loop pulled tight on the stitch
  ctx.save();
  ctx.translate(x - 7, y - 7);
  ctx.scale(14 / 24, 14 / 24);
  ctx.strokeStyle = color; ctx.lineWidth = 3.4; ctx.lineCap = 'butt';
  const p = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');
  ctx.stroke(p);
  ctx.restore();
}

// ------------------------------------------------------------------ THE TWILL
let twillCache: string | null = null;
/** Renders the twill tile on the canvas (a 96px tile at dpr) and returns a data URL to tile. */
export function twill(canvas: HTMLCanvasElement, tile = 96): string {
  const dpr = DPR();
  canvas.width = tile * dpr; canvas.height = tile * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTwill(ctx, tile);
  return canvas.toDataURL('image/png');
}
export function applyTwill(el: HTMLElement) {
  if (el.dataset.twill === 'file') return;   // the pre rendered /assets/texture/twill.webp is in the CSS
  try {
    if (!twillCache) twillCache = sessionStorage.getItem('savebrew.twill');
  } catch { /* storage may be unavailable */ }
  if (!twillCache) {
    const c = document.createElement('canvas');
    twillCache = twill(c);
    try { sessionStorage.setItem('savebrew.twill', twillCache); } catch { /* ignore */ }
  }
  el.style.setProperty('--twill-image', `url("${twillCache}")`);
}

// ------------------------------------------------------------------ THE THREAD STRIP
export interface ThreadStripHandle { draw: (progress: number) => void; resize: () => void; }
/** Five short vertical threads at the five column centres with a per load sag; draw(progress) draws them top down. */
export function threadStrip(canvas: HTMLCanvasElement, opts: { color?: string; sag?: number } = {}): ThreadStripHandle {
  const color = opts.color || INDIGO;
  const seed = String(Math.random());
  const rand = rng(seed);
  const sags = [0, 1, 2, 3, 4].map(() => (rand() - 0.5) * 2 * (opts.sag ?? 5));
  let last = 1;
  const draw = (progress: number) => {
    last = progress;
    const { w, h, ctx } = size(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + 0.2 * i);
      const p = Math.max(0, Math.min(1, progress * 5 - i * 0.7));   // 70ms of stagger per thread
      if (p <= 0) continue;
      const y1 = 2, y2 = h - 4;
      const yEnd = y1 + (y2 - y1) * p;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      // a quadratic with the control point pushed sideways by the sag, so the thread bows like slack cotton
      const cx = x + sags[i] * p, cy = (y1 + yEnd) / 2;
      ctx.quadraticCurveTo(cx, cy, x, yEnd);
      ctx.stroke();
    }
  };
  const resize = () => draw(last);
  return { draw, resize };
}

// ------------------------------------------------------------------ auto init
function inView(el: Element, cb: () => void, threshold = 0.2) {
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); cb(); }
  }, { threshold, rootMargin: '0px 0px -5% 0px' });
  io.observe(el);
}
export function initSurfaces(root: ParentNode = document) {
  const reduced = motionReduced();
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-selvedge]').forEach((c) => {
    if (c.dataset.selvedge === 'loader' || c.dataset.ready) return;
    c.dataset.ready = '1';
    const h = selvedge(c, c.dataset.seed || 'selvedge', { orientation: (c.dataset.orientation as any) || 'horizontal' });
    if (reduced) { h.draw(1); }
    else { h.draw(0); inView(c, () => tween(DUR.slow, SHUTTLE, (v) => h.draw(v))); }
    new ResizeObserver(() => h.resize()).observe(c);
  });
  root.querySelectorAll<HTMLElement>('[data-twill]').forEach(applyTwill);
  root.querySelectorAll<HTMLElement>('[data-threadstrip]').forEach((el) => {
    const c = el.querySelector<HTMLCanvasElement>('canvas');
    if (!c || c.dataset.ready) return;
    c.dataset.ready = '1';
    const h = threadStrip(c, { sag: el.classList.contains('threadstrip--compact') ? 3 : 5 });
    if (reduced) h.draw(1);
    else { h.draw(0); inView(el, () => tween(DUR.base * 2, SHUTTLE, (v) => h.draw(v))); }
    new ResizeObserver(() => h.resize()).observe(c);
  });
}
