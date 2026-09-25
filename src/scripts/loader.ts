// The loader (3.18, preloader_module.md): the selvedge stitch. The page is painted in full at first paint; a
// dashed indigo running stitch draws down the left gutter in step with the real load fraction (fonts ready,
// the DOM parsed, any [data-loader-track] image decoded, anything registered through sbLoader.track(), for
// example the Three.js fetch on Home), ties off with a knot at ready, and fades. "Go straight in" at the
// bottom centre completes it at once; the 4s hard cap force completes it. Nothing counts, nothing flips,
// nothing is covered. Reduced motion renders the stitch complete and fades it in 0.3s.
import { selvedge } from './surfaces';
import { SHUTTLE, KNOT, DUR, motionReduced, tween } from './ease';

const root = document.querySelector<HTMLElement>('[data-loader]');
const canvas = root?.querySelector<HTMLCanvasElement>('canvas[data-selvedge="loader"]');
const skip = root?.querySelector<HTMLAnchorElement>('[data-loader-skip]');

const tracked: { label: string; done: boolean }[] = [];
let finished = false;
const started = 0; // elapsed time is measured from navigation start, so the 4s cap holds from the first paint

function fraction(): number {
  if (!tracked.length) return 1;
  return tracked.filter((t) => t.done).length / tracked.length;
}
/** Register a promise the loader waits for (the stitch length follows the fraction of tracked items that have resolved). */
export function track(p: Promise<unknown>, label = 'asset'): Promise<unknown> {
  const item = { label, done: false };
  tracked.push(item);
  const settle = () => { item.done = true; };
  p.then(settle, settle);
  return p;
}
export function ready(): boolean { return finished; }
const api = { track, ready, complete: () => finish('skip') };
declare global { interface Window { sbLoader: typeof api } }
window.sbLoader = api;

function finish(reason: string) {
  if (finished || !root) return;
  finished = true;
  root.dataset.reason = reason;
  const done = () => {
    document.documentElement.dataset.loaded = 'true';
    document.dispatchEvent(new CustomEvent('sb:ready', { detail: { reason, ms: Math.round(performance.now() - started) } }));
    root.classList.add('is-done');
    setTimeout(() => root.remove(), 400);
  };
  if (!handle) return done();
  if (motionReduced()) { handle.draw(1); handle.tieOff(0.985); return done(); }
  // pull the stitch to the foot (Shuttle) then tie off with the knot (Knot, 0.38s)
  const from = shown;
  tween(Math.max(80, DUR.base * (1 - from)), SHUTTLE, (v) => { shown = from + (1 - from) * v; handle!.draw(shown); }).then(() => {
    shown = 1;
    handle!.draw(1);
    tween(DUR.base, KNOT, () => { handle!.tieOff(0.985); }).then(done);
  });
}

let handle: ReturnType<typeof selvedge> | null = null;
let shown = 0;

if (root && canvas) {
  canvas.setAttribute('aria-valuenow', '0');
  handle = selvedge(canvas, 'loader', { orientation: 'vertical' });
  if (motionReduced()) {
    handle.draw(1);
    finish('reduced');
  } else {
    // the real load: fonts, the parsed document, tracked images, and whatever pages register before ready
    track(document.fonts ? document.fonts.ready : Promise.resolve(), 'fonts');
    track(new Promise<void>((r) => { if (document.readyState !== 'loading') r(); else document.addEventListener('DOMContentLoaded', () => r(), { once: true }); }), 'dom');
    document.querySelectorAll<HTMLImageElement>('img[data-loader-track]').forEach((img) => {
      track(img.decode ? img.decode().catch(() => undefined) : Promise.resolve(), 'image');
    });
    // let pages register their own work (Three.js on Home) during the first frames before the loader can finish
    const tick = () => {
      if (finished) return;
      const target = fraction();
      shown += (target - shown) * 0.12;
      handle!.draw(shown);
      canvas.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
      const elapsed = performance.now() - started;
      if ((target >= 1 && shown > 0.985 && elapsed > 120) || elapsed > 4000) finish(elapsed > 4000 ? 'cap' : 'load');
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  skip?.addEventListener('click', (e) => { e.preventDefault(); finish('skip'); });
  new ResizeObserver(() => handle?.resize()).observe(canvas);
}
export default api;
