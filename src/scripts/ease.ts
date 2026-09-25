// The two curves of the motion signature (3.11) as functions, for canvas and rAF work. Nothing else is permitted.
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const C = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(t, y1, y2);
  };
}
export const SHUTTLE = cubicBezier(0.36, 0.01, 0.1, 1);
export const KNOT = cubicBezier(0.22, 1.12, 0.36, 1);
export const DUR = { fast: 110, base: 380, slow: 1200, idle: 11000 } as const;
export const EASE_CSS = { shuttle: 'cubic-bezier(0.36, 0.01, 0.10, 1)', knot: 'cubic-bezier(0.22, 1.12, 0.36, 1)' } as const;

/** True when motion must be static: the OS setting, the site's reduce motion control, or the ?qa=rm hook. */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  return false;
}

/** A small rAF tween: calls step(eased) from 0 to 1 over ms with the given curve; resolves when done. */
export function tween(ms: number, ease: (t: number) => number, step: (v: number, raw: number) => void, delay = 0): Promise<void> & { cancel: () => void } {
  let raf = 0;
  let cancelled = false;
  const p = new Promise<void>((resolve) => {
    const start = performance.now() + delay;
    const frame = (now: number) => {
      if (cancelled) return;
      const raw = Math.min(1, Math.max(0, (now - start) / ms));
      step(ease(raw), raw);
      if (raw < 1) raf = requestAnimationFrame(frame);
      else resolve();
    };
    raf = requestAnimationFrame(frame);
  }) as Promise<void> & { cancel: () => void };
  p.cancel = () => { cancelled = true; cancelAnimationFrame(raf); };
  return p;
}
