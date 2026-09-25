// Home (/): the page's own behaviour. The loom (loom.ts) on desktop with a fine pointer, the mobile hero
// (mobile-hero.ts) under 900px or on a coarse pointer, The Tightening on the H1 timed to the first weft pass,
// the week strip's knot matrix, the dashboard switch and its populate entrance, the docking of Today's pass
// onto the five warp positions (driven by the loom's per frame projection, or by a static position table when
// the loom is off), the ScrollTrigger scrub over 1.3 viewport heights, and the ?qa=arc hook.
import { motionReduced, KNOT, SHUTTLE, DUR, tween } from '../../scripts/ease';

type Progress = (p: number) => void;
const qa = new URLSearchParams(location.search).get('qa') || '';
const reduced = motionReduced();
const desktopLoom = matchMedia('(min-width: 900px) and (pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches;
const SIG_LENGTH = 1.3; // the signature scroll length in viewport heights (1.25 to 1.75 budget)

const hero = document.querySelector<HTMLElement>('[data-hero]');
const h1 = document.querySelector<HTMLElement>('h1[data-tighten]');
const board = document.querySelector<HTMLElement>('[data-dock-board]');
const cells = board ? Array.from(board.querySelectorAll<HTMLElement>('.hm-today-cell')) : [];

// ------------------------------------------------------------------ The Tightening (TYP-003), once on load
let tightened = false;
function runTightening() {
  if (tightened || !h1) return;
  tightened = true;
  const go = () => window.sbMotion?.tighten(h1);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
}
if (reduced) runTightening();
else {
  // the loom's first weft pass starts it (sb:loom-weft); otherwise it runs once the stitch has tied off, or at 1.5s at the latest
  document.addEventListener('sb:loom-weft', runTightening, { once: true });
  document.addEventListener('sb:ready', () => setTimeout(runTightening, desktopLoom ? 900 : 120), { once: true });
  setTimeout(runTightening, 2600);
}

// ------------------------------------------------------------------ the scroll progress source (GSAP ScrollTrigger scrub 0.08, or a scroll listener)
const listeners: Progress[] = [];
let progress = 0;
let arcLogged = false;
export function onProgress(fn: Progress) { listeners.push(fn); fn(progress); }
function emit(p: number) { progress = p; for (const fn of listeners) fn(p); }
async function startProgress() {
  const vh = () => window.innerHeight || 900;
  const logArc = (start: number, end: number) => {
    if (qa === 'arc' && !arcLogged) { arcLogged = true; console.log(`[qa=arc] THE PASS timeline: start ${Math.round(start)}px, end ${Math.round(end)}px, length ${((end - start) / vh()).toFixed(2)} viewport heights`); }
  };
  try {
    const { gsap, ScrollTrigger } = await window.sbMotion.loadGsap();
    const state = { p: 0 };
    const tl = gsap.to(state, {
      p: 1, ease: 'none',
      scrollTrigger: { start: 0, end: () => SIG_LENGTH * vh(), scrub: 0.08, invalidateOnRefresh: true, onRefresh: (self: any) => logArc(self.start, self.end) }
    });
    logArc(0, SIG_LENGTH * vh());
    gsap.ticker.add(() => { if (Math.abs(state.p - progress) > 0.0005 || state.p !== progress) emit(state.p); });
    const api = Object.assign((window as any).sbHome || {}, { scrollTrigger: tl.scrollTrigger, emit });
    Object.defineProperty(api, 'progress', { get: () => progress, configurable: true });
    (window as any).sbHome = api;
  } catch {
    // no GSAP: a scroll listener with the same 0.08 lerp
    let target = 0, shown = 0, raf = 0;
    const tick = () => { shown += (target - shown) * 0.16; if (Math.abs(target - shown) < 0.0005) { shown = target; emit(shown); raf = 0; return; } emit(shown); raf = requestAnimationFrame(tick); };
    const onScroll = () => { target = Math.max(0, Math.min(1, window.scrollY / (SIG_LENGTH * vh()))); if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    logArc(0, SIG_LENGTH * vh());
  }
}

// ------------------------------------------------------------------ the docking of Today's pass onto the five warp positions
// threadX(i, y) gives the thread's projected x at screen y (the loom's per frame projection); the static table is the fallback.
export interface DockGeometry { left: number[]; centre: number[]; pad: number; headY: number[] }
let dockGeo: DockGeometry | null = null;
function measureDock(): DockGeometry | null {
  if (!board || cells.length !== 5) return null;
  const left: number[] = [], centre: number[] = [], headY: number[] = [];
  let pad = 0;
  for (const c of cells) {
    const prev = c.style.transform; c.style.transform = 'none';
    const r = c.getBoundingClientRect();
    c.style.transform = prev;
    pad = parseFloat(getComputedStyle(c).paddingLeft) || 0;
    left.push(r.left + pad + 8); // the knot beside the cell head sits 8px in
    centre.push(r.left + r.width / 2);
    const head = c.querySelector<HTMLElement>('.cell-head');
    headY.push(head ? head.getBoundingClientRect().top + 9 : r.top + 24);
  }
  return { left, centre, pad, headY };
}
export function dockGeometry(): DockGeometry | null {
  if (!dockGeo) dockGeo = measureDock();
  if (dockGeo) {
    // the head y is live (the row scrolls), the x table is cached until a resize
    cells.forEach((c, i) => { const head = c.querySelector<HTMLElement>('.cell-head'); dockGeo!.headY[i] = head ? head.getBoundingClientRect().top + 9 : c.getBoundingClientRect().top + 24; });
  }
  return dockGeo;
}
window.addEventListener('resize', () => { dockGeo = null; });
let staticX = (i: number, p: number) => {
  const g = dockGeometry(); if (!g) return 0;
  const f = KNOT(Math.max(0, Math.min(1, (p - 0.6) / 0.3)));
  return g.centre[i] + (g.left[i] - g.centre[i]) * f;
};
let liveX: ((i: number, y: number, p: number) => number) | null = null;
export function setThreadProjection(fn: ((i: number, y: number, p: number) => number) | null) { liveX = fn; }
function applyDock(p: number) {
  if (!board || cells.length !== 5 || reduced) return;
  const g = dockGeometry(); if (!g) return;
  board.classList.add('is-loom-docking');
  const dockT = Math.max(0, Math.min(1, (p - 0.6) / 0.3));
  const hand = Math.max(0, Math.min(1, (p - 0.9) / 0.1));
  cells.forEach((c, i) => {
    c.classList.add('is-docking');
    const local = Math.max(0, Math.min(1, (dockT * 0.3 * 1000 - i * 40) / (0.3 * 1000 - 4 * 40)));
    const rise = KNOT(local);
    const x = liveX ? liveX(i, g.headY[i], p) : staticX(i, p);
    // the cell's left edge (its knot) is pinned to the thread's projected x; it rises 28px onto it
    const dx = p < 0.6 ? 0 : (x - g.left[i]) * (1 - hand);
    c.style.setProperty('--dock-x', `${dx.toFixed(2)}px`);
    c.style.setProperty('--dock-y', `${(28 * (1 - rise)).toFixed(2)}px`);
    c.style.setProperty('--dock-o', p < 0.6 ? '0' : rise.toFixed(3));
  });
  // the white weft block and the strip fade in at the handoff (0.9 to 1.0) as the canvas fades
  board.style.setProperty('--board-o', SHUTTLE(hand).toFixed(3));
  board.style.setProperty('--strip-o', KNOT(hand).toFixed(3));
}

// ------------------------------------------------------------------ the week strip: twenty five knots, one item beneath
function initWeek() {
  const week = document.querySelector<HTMLElement>('[data-week]');
  if (!week) return;
  const data: { weekday: string; date: string; items: { key: string; thread: string; headline: string; summary: string }[] }[] = JSON.parse(week.dataset.weekData || '[]');
  const knots = Array.from(week.querySelectorAll<HTMLButtonElement>('.hm-week__knot'));
  const item = week.querySelector<HTMLElement>('[data-week-item]')!;
  const thread = week.querySelector<HTMLElement>('[data-week-item-thread]')!;
  const date = week.querySelector<HTMLElement>('[data-week-item-date]')!;
  const headline = week.querySelector<HTMLElement>('[data-week-item-headline]')!;
  const summary = week.querySelector<HTMLElement>('[data-week-item-summary]')!;
  const threadNames = data[0].items.map((it) => it.thread);
  knots.forEach((k) => { k.dataset.threadName = threadNames[Number(k.dataset.item)]; });
  let current = '0-0';
  const show = (di: number, ti: number) => {
    const key = `${di}-${ti}`;
    if (key === current) return;
    current = key;
    const it = data[di].items[ti];
    knots.forEach((k) => k.setAttribute('aria-pressed', k.dataset.day === String(di) && k.dataset.item === String(ti) ? 'true' : 'false'));
    thread.textContent = it.thread; date.textContent = data[di].date; headline.textContent = it.headline; summary.textContent = it.summary;
    if (!motionReduced()) { item.classList.remove('is-wiping'); void item.offsetWidth; item.classList.add('is-wiping'); }
  };
  knots.forEach((k) => {
    const open = () => show(Number(k.dataset.day), Number(k.dataset.item));
    k.addEventListener('click', open);
    k.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(); });
    k.addEventListener('focus', open);
  });
  item.addEventListener('animationend', () => item.classList.remove('is-wiping'));
  // the hero loop plays only in view and only with motion on; reduced motion shows the poster
  const video = week.querySelector<HTMLVideoElement>('[data-week-video]');
  const setReduced = () => week.classList.toggle('is-reduced', motionReduced());
  setReduced();
  new MutationObserver(setReduced).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  if (video) {
    video.addEventListener('error', () => { week.dataset.video = 'off'; }, true);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !motionReduced() && !document.hidden) video.play().catch(() => { week.dataset.video = 'off'; });
        else video.pause();
      }
    }, { threshold: 0.2 });
    io.observe(week);
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  }
}

// ------------------------------------------------------------------ the dashboard: the switch, the captions, the pan clip, the populate entrance
function initDashboard() {
  const dash = document.querySelector<HTMLElement>('[data-dash]');
  if (!dash) return;
  const opts = Array.from(dash.querySelectorAll<HTMLButtonElement>('[data-show-view]'));
  const caption = dash.querySelector<HTMLElement>('[data-dash-caption]');
  const markModules = () => {
    dash.querySelectorAll<HTMLElement>('.sb-app').forEach((app) => {
      app.querySelectorAll<HTMLElement>('.bar, .main > *, .rail > *, .app-footer').forEach((m, i) => m.style.setProperty('--m', String(i)));
    });
  };
  markModules();
  const pick = (view: string, focus = false) => {
    opts.forEach((o) => { const on = o.dataset.showView === view; o.setAttribute('aria-checked', on ? 'true' : 'false'); o.tabIndex = on ? 0 : -1; if (on && focus) o.focus(); if (on && caption) caption.textContent = o.dataset.caption || ''; });
    dash.classList.add('is-populated');
  };
  opts.forEach((o, i) => {
    o.addEventListener('click', () => pick(o.dataset.showView!));
    o.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const next = opts[(i + dir + opts.length) % opts.length];
      next.click(); pick(next.dataset.showView!, true);
    });
  });
  // the product-ui group listens to [data-show-view] clicks itself; keep the radio state in step
  dash.addEventListener('sb:product-view', (e: any) => pick(e.detail.view));
  // the entrance: modules populate top to bottom, then one Texts toggle clicks on (Knot); the pan clip plays once
  const pan = dash.querySelector<HTMLElement>('[data-dash-pan]');
  const panVideo = dash.querySelector<HTMLVideoElement>('[data-dash-pan-video]');
  let played = false;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || played) continue;
      played = true;
      io.disconnect();
      if (motionReduced()) { dash.classList.add('is-populated'); return; }
      const count = dash.querySelectorAll('.sb-app:not([hidden]) :is(.bar, .main > *, .rail > *, .app-footer)').length;
      setTimeout(() => {
        dash.classList.add('is-populated');
        const toggle = dash.querySelector<HTMLElement>('.sb-app[data-product="today"]:not([hidden]) .toggle');
        if (toggle) {
          toggle.setAttribute('aria-checked', 'false');
          setTimeout(() => { toggle.setAttribute('aria-checked', 'true'); toggle.classList.add('is-clicked'); }, 420);
        }
      }, DUR.base + count * 40 + 60);
      if (pan && panVideo) {
        pan.hidden = false;
        panVideo.play().then(() => {
          panVideo.addEventListener('ended', () => { pan.classList.add('is-done'); setTimeout(() => { pan.hidden = true; }, DUR.base); }, { once: true });
        }).catch(() => { pan.hidden = true; });
        setTimeout(() => { if (!pan.hidden) { pan.classList.add('is-done'); setTimeout(() => { pan.hidden = true; }, DUR.base); } }, 9000);
      }
    }
  }, { threshold: 0.35 });
  io.observe(dash);
  // the row 2 link scrolls here under the sticky band
  document.querySelectorAll<HTMLAnchorElement>('[data-scroll-dashboard]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.getElementById('dashboard'); if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: y, behavior: motionReduced() ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#dashboard');
  }));
}

// ------------------------------------------------------------------ boot
function boot() {
  initWeek();
  initDashboard();
  if (!hero) return;
  if (desktopLoom) {
    if (!reduced) {
      startProgress();
      onProgress(applyDock);
    } else {
      // reduced motion: the poster with the cells docked and the strip static
      hero.querySelector<HTMLElement>('[data-loom]')?.classList.add('is-poster');
    }
    // the loom itself loads after first paint behind the poster
    const start = () => import('./loom').then((m) => m.mountLoom({ hero, onProgress, setThreadProjection, dockGeometry, reduced, qa })).catch((err) => console.warn('[loom] not mounted', err));
    if (reduced) start();
    else if ('requestIdleCallback' in window) (window as any).requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 300);
  } else {
    import('./mobile-hero').then((m) => m.mountMobileHero(hero)).catch((err) => console.warn('[mobile hero] not mounted', err));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
