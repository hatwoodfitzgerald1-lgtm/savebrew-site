// The motion system (Art Direction 3.8 to 3.13). Loaded once by <Layout>, deferred.
//   - GSAP 3 core, ScrollTrigger and Flip from cdnjs, loaded on demand through loadGsap()
//   - the entrance vocabulary: data-entrance="weft-left|weft-right|dock|knots|stitch|pop" (+ data-stagger, data-entrance-items)
//   - the per page text hovers: data-hover="pluck|tighten|stitch|knot|lift|dye|dash|unspool" on <body>
//   - the scroll driven CSS animations (EXP-005) with the scroll-timeline polyfill for Safari
//   - The Tightening (TYP-003): tighten(el)
//   - the PageScene slot: <div data-scene="kind"> mounts src/scripts/scenes/<kind>.ts, paused offscreen and on hidden tabs
//   - the reduce motion contract: prefers-reduced-motion and data-motion="reduced" (and ?qa=rm) give static end states
import { motionReduced, cubicBezier, SHUTTLE, KNOT, tween, DUR, EASE_CSS } from './ease';
import { initSurfaces } from './surfaces';
import type { Scene } from './scenes/base';

declare global {
  interface Window { sbMotion: typeof api; gsap?: any; ScrollTrigger?: any; Flip?: any; }
}

const GSAP_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/';

function loadScript(src: string, timeout = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded) return resolve();
    const s = existing || document.createElement('script');
    const timer = setTimeout(() => reject(new Error('timeout ' + src)), timeout);
    s.addEventListener('load', () => { s.dataset.loaded = '1'; clearTimeout(timer); resolve(); });
    s.addEventListener('error', () => { clearTimeout(timer); reject(new Error('failed ' + src)); });
    if (!existing) { s.src = src; s.async = true; s.defer = true; document.head.appendChild(s); }
  });
}

// ------------------------------------------------------------------ GSAP, on demand
let gsapPromise: Promise<{ gsap: any; ScrollTrigger: any; Flip: any }> | null = null;
/** Loads GSAP 3.12.5 core, ScrollTrigger and Flip from cdnjs once; registers the "shuttle" and "knot" eases. */
export function loadGsap(): Promise<{ gsap: any; ScrollTrigger: any; Flip: any }> {
  if (gsapPromise) return gsapPromise;
  gsapPromise = (async () => {
    await loadScript(GSAP_BASE + 'gsap.min.js');
    await Promise.all([loadScript(GSAP_BASE + 'ScrollTrigger.min.js'), loadScript(GSAP_BASE + 'Flip.min.js')]);
    const g = window.gsap;
    if (!g) throw new Error('gsap did not load');
    g.registerPlugin(window.ScrollTrigger, window.Flip);
    // CustomEase is not shipped; the two curves are registered from their control points with a small solver
    g.registerEase('shuttle', cubicBezier(0.36, 0.01, 0.1, 1));
    g.registerEase('knot', cubicBezier(0.22, 1.12, 0.36, 1));
    g.defaults({ ease: 'shuttle', duration: DUR.base / 1000 });
    return { gsap: g, ScrollTrigger: window.ScrollTrigger, Flip: window.Flip };
  })();
  gsapPromise.catch(() => { gsapPromise = null; });
  return gsapPromise;
}

// ------------------------------------------------------------------ scroll driven CSS (EXP-005)
let timelinePromise: Promise<boolean> | null = null;
/** Resolves true when animation-timeline works (natively or through the polyfill). */
export function ensureScrollTimeline(): Promise<boolean> {
  if (timelinePromise) return timelinePromise;
  timelinePromise = (async () => {
    if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: view()')) return true;
    try { await loadScript('/assets/js/scroll-timeline.js'); return true; }
    catch { document.documentElement.classList.add('no-scroll-timeline'); return false; }
  })();
  return timelinePromise;
}

// ------------------------------------------------------------------ entrances
function markItems(el: HTMLElement) {
  const sel = el.dataset.entranceItems;
  const items: Element[] = sel ? Array.from(el.querySelectorAll(sel)) : Array.from(el.children);
  items.forEach((item, i) => { item.classList.add('ent-item'); (item as HTMLElement).style.setProperty('--i', String(i)); });
  if (el.dataset.stagger) el.style.setProperty('--stagger', el.dataset.stagger + 'ms');
}
function observeIn(el: Element, onIn: () => void, threshold = 0.15) {
  if (!('IntersectionObserver' in window)) { onIn(); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); onIn(); }
  }, { threshold, rootMargin: '0px 0px -8% 0px' });
  io.observe(el);
}
export function initEntrances(root: ParentNode = document) {
  const reduced = motionReduced();
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-entrance]'));
  let needsTimeline = false;
  for (const el of els) {
    if (el.dataset.entranceReady) continue;
    el.dataset.entranceReady = '1';
    const kind = el.dataset.entrance;
    if (kind === 'dock' || kind === 'knots' || kind === 'stitch' || kind === 'pop') markItems(el);
    if (reduced) { el.classList.add('is-in'); continue; }
    if (kind === 'weft-left' || kind === 'weft-right') needsTimeline = true;
    // rows already in the first viewport at load show at once (no veil over the first paint); rows below enter as they arrive
    if (el.getBoundingClientRect().top < window.innerHeight * 0.6) el.classList.add('is-initial');
    observeIn(el, () => el.classList.add('is-in'));
  }
  // things that draw themselves when in view even without a data-entrance (the seal, weft passes, knots that draw)
  root.querySelectorAll<HTMLElement>('.seal--weave, .weft-pass, .knot--draw').forEach((el) => {
    if (el.dataset.inReady || el.closest('[data-entrance]')) return;
    el.dataset.inReady = '1';
    if (reduced) el.classList.add('is-in'); else observeIn(el, () => el.classList.add('is-in'), 0.3);
  });
  if (needsTimeline && !reduced) ensureScrollTimeline();
}

// ------------------------------------------------------------------ hovers
const HOVER_TARGETS = 'a, h1, h2, h3, .hv';
function firstGrapheme(text: string): [string, string] {
  const trimmed = text.replace(/^\s+/, '');
  if (!trimmed) return ['', text];
  let first = trimmed[0];
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) { const it = new Seg('en', { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]().next(); if (!it.done) first = it.value.segment; }
  } catch { /* fallback to the first code unit */ }
  return [first, trimmed.slice(first.length)];
}
let pluckFilter: SVGFEDisplacementMapElement | null = null;
function ensurePluckFilter() {
  if (pluckFilter) return pluckFilter;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = '<filter id="sb-pluck" x="-5%" y="-20%" width="110%" height="140%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
  document.body.appendChild(svg);
  pluckFilter = svg.querySelector('feDisplacementMap');
  return pluckFilter!;
}
export function initHovers(root: ParentNode = document) {
  const body = document.body;
  const kind = body.dataset.hover;
  if (!kind) return;
  body.classList.add('hv-' + kind);
  const container = root === document ? document.body : (root as HTMLElement);
  if (kind === 'knot') {
    container.querySelectorAll<HTMLElement>(HOVER_TARGETS).forEach((el) => {
      if (el.dataset.knotReady || el.classList.contains('bobbin') || el.classList.contains('chip')) return;
      el.dataset.knotReady = '1';
      const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent!.trim()) as Text | undefined;
      if (!node) return;
      const [first, rest] = firstGrapheme(node.textContent || '');
      if (!first) return;
      const lead = (node.textContent || '').match(/^\s*/)![0];
      const span = document.createElement('span'); span.className = 'knot-letter'; span.textContent = first;
      const after = document.createTextNode(rest);
      node.textContent = lead;
      node.after(span, after);
    });
  }
  if (kind === 'pluck' && !motionReduced() && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const fe = ensurePluckFilter();
    let active: ReturnType<typeof tween> | null = null;
    container.querySelectorAll<HTMLElement>('h1, h2, h3, .hv').forEach((el) => {
      if (el.dataset.pluckReady) return;
      el.dataset.pluckReady = '1';
      el.addEventListener('pointerenter', () => {
        if (motionReduced()) return;
        if (active) active.cancel();
        el.style.filter = 'url(#sb-pluck)';
        // the thread plucked and released: the displacement scale runs 0 to 6 to 0 over 0.38s on Knot
        active = tween(DUR.base, KNOT, (v) => { fe.setAttribute('scale', String(6 * Math.sin(Math.PI * v))); });
        active.then(() => { fe.setAttribute('scale', '0'); el.style.filter = ''; active = null; });
      });
    });
  }
}

// ------------------------------------------------------------------ The Tightening (TYP-003)
export interface TightenOptions { from?: number; to?: number; perGlyph?: number; delay?: number; }
/** Splits the element into grapheme spans and pulls each from wght 500 to 800, left to right at 18ms per glyph (Knot). */
export function tighten(el: HTMLElement, opts: TightenOptions = {}): Promise<void> {
  el.classList.add('tighten');
  const from = opts.from ?? 500, to = opts.to ?? 800;
  el.style.setProperty('--wght', String(from));
  if (motionReduced()) { el.style.setProperty('--wght', String(to)); el.classList.add('is-tight'); return Promise.resolve(); }
  if (!el.classList.contains('is-split')) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    let i = 0;
    const Seg = (Intl as any).Segmenter;
    for (const node of nodes) {
      const text = node.textContent || '';
      const parts: string[] = Seg ? Array.from(new Seg('en', { granularity: 'grapheme' }).segment(text), (s: any) => s.segment) : Array.from(text);
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        const span = document.createElement('span');
        span.className = 'g';
        span.textContent = p;
        span.style.setProperty('--i', String(p.trim() ? i++ : i));
        frag.appendChild(span);
      }
      node.replaceWith(frag);
    }
    el.classList.add('is-split');
    el.dataset.glyphs = String(i);
  }
  const perGlyph = opts.perGlyph ?? (matchMedia('(max-width: 767px)').matches ? 9 : 18);
  el.style.setProperty('--glyph-stagger', perGlyph + 'ms');
  const glyphs = Number(el.dataset.glyphs || 0);
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        el.style.setProperty('--wght', String(to));
        el.classList.add('is-tight');
        setTimeout(resolve, DUR.base + glyphs * perGlyph);
      });
    }, opts.delay ?? 0);
  });
}
function initTighten() {
  document.querySelectorAll<HTMLElement>('[data-tighten]').forEach((el) => {
    if (el.dataset.tighten === 'manual') { el.classList.add('tighten'); return; }
    el.classList.add('tighten');
    const run = () => { observeIn(el, () => tighten(el), 0.1); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
  });
}

// ------------------------------------------------------------------ scenes (one per page, lazy, paused offscreen)
const sceneModules = import.meta.glob('./scenes/*.ts');
const scenes: Scene[] = [];
export async function initScenes(root: ParentNode = document) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'))) {
    if (el.dataset.sceneReady) continue;
    el.dataset.sceneReady = '1';
    const kind = el.dataset.scene!;
    const key = `./scenes/${kind}.ts`;
    const loader = sceneModules[key];
    if (!loader) { console.warn(`[scene] no scene module for kind "${kind}" (src/scripts/scenes/${kind}.ts)`); continue; }
    try {
      const mod: any = await loader();
      const scene: Scene = mod.default(el);
      scenes.push(scene);
      el.dataset.sceneState = 'mounted';
    } catch (err) {
      console.warn('[scene] failed to mount', kind, err);
    }
  }
}

// ------------------------------------------------------------------ init
const api = { loadGsap, ensureScrollTimeline, initEntrances, initHovers, initScenes, initSurfaces, tighten, motionReduced, SHUTTLE, KNOT, DUR, EASE_CSS, tween, scenes };
window.sbMotion = api;

function boot() {
  initEntrances();
  initHovers();
  initSurfaces();
  initTighten();
  // scenes wait for first paint so the hero copy and the loader are never delayed by a canvas
  const start = () => initScenes();
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 200);
  // the reduce motion control flips data-motion at runtime; static end states apply at once
  new MutationObserver(() => {
    if (motionReduced()) {
      document.querySelectorAll('[data-entrance], .seal--weave, .weft-pass, .knot--draw').forEach((el) => el.classList.add('is-in'));
      document.querySelectorAll<HTMLElement>('.tighten').forEach((el) => { el.style.setProperty('--wght', '800'); el.classList.add('is-tight'); });
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
export default api;
