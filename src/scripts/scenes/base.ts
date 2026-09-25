// The PageScene base: one lightweight canvas per page, mounted lazily after first paint, paused offscreen
// (IntersectionObserver) and on hidden tabs, dpr capped at 1.5 (1.0 on touch), disposed on pagehide,
// static end state when motion is reduced. Subclasses draw in frame() and lay out in resize().
import { motionReduced } from '../ease';

export abstract class Scene {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  w = 0;
  h = 0;
  reduced: boolean;
  visible = false;
  running = false;
  disposed = false;
  private raf = 0;
  private last = 0;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private onVis = () => { if (document.hidden) this.stop(); else if (this.visible) this.start(); };
  private onHide = () => this.dispose();

  constructor(root: HTMLElement) {
    this.root = root;
    this.canvas = root.querySelector('canvas') || root.appendChild(document.createElement('canvas'));
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(coarse ? 1 : 1.5, window.devicePixelRatio || 1);
    this.reduced = motionReduced();
    this.resizeCanvas();
    this.ro = new ResizeObserver(() => { this.resizeCanvas(); this.resize(); this.draw(0); });
    this.ro.observe(root);
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) { this.visible = e.isIntersecting; if (this.visible && !document.hidden) this.start(); else this.stop(); }
    }, { threshold: 0.05 });
    this.io.observe(root);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('pagehide', this.onHide, { once: true });
    new MutationObserver(() => { this.reduced = motionReduced(); this.draw(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    this.resize();
    this.draw(0);
  }
  private resizeCanvas() {
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  /** 0 at the root's top entering the viewport bottom, 1 at its bottom leaving the top. */
  progress(): number {
    const r = this.root.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
  }
  start() {
    if (this.running || this.disposed || this.reduced) { if (this.reduced) this.draw(0); return; }
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(64, now - this.last);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() {
    this.stop(); this.disposed = true;
    this.io?.disconnect(); this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
  }
  private draw(dt: number) {
    if (this.disposed) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.frame(performance.now(), dt);
  }
  abstract resize(): void;
  abstract frame(t: number, dt: number): void;
}
