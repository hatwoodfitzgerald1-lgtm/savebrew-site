// THE DESIGNED MOBILE HERO (Art Direction 3.20), PULL A THREAD: under 900px or on a coarse pointer the loom is
// replaced by a 180px 2D canvas band under the standfirst and the Bobbin: five vertical threads across the full
// width (one per column position), sagging slightly, labelled beneath with the thread name and knot. A one finger
// drag down on a thread pulls it (the canvas draws the thread stretching with the finger, Knot easing on release);
// past 40px the thread's card slides out beneath the band with today's headline and action chip; releasing early
// springs the thread back; a tap opens the card too. Reduced motion: the band is static, the cards open without animation.
import { KNOT, DUR, motionReduced, tween } from '../../scripts/ease';

const INDIGO = '#2B2F8F', DEEP = '#1B1E5C', PALE = '#F9EFC1';
const KNOT_PATH = new Path2D('M12 2V4.8M12 8.4V22M2.5 12H8.4C8.4 8.4 10 6.6 12 6.6C14 6.6 15.6 8.4 15.6 12H21.5M15.6 12C15.6 13.6 14.6 14.6 13.5 14.9M10.5 14.9C9.4 14.6 8.4 13.6 8.4 12');
interface Item { key: string; thread: string; headline: string; summary: string; chip: string }

export function mountMobileHero(hero: HTMLElement) {
  const root = hero.querySelector<HTMLElement>('[data-mobile-hero]');
  const canvas = root?.querySelector<HTMLCanvasElement>('canvas');
  if (!root || !canvas) return;
  const items: Item[] = JSON.parse(hero.dataset.items || '[]');
  const card = root.querySelector<HTMLElement>('[data-mobile-card]')!;
  const cardThread = card.querySelector<HTMLElement>('[data-mobile-card-thread] span')!;
  const cardHeadline = card.querySelector<HTMLElement>('[data-mobile-card-headline]')!;
  const cardSummary = card.querySelector<HTMLElement>('[data-mobile-card-summary]')!;
  const cardChip = card.querySelector<HTMLElement>('[data-mobile-card-chip]')!;
  const cardClose = card.querySelector<HTMLElement>('[data-mobile-card-close]')!;
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(matchMedia('(pointer: coarse)').matches ? 1 : 1.5, window.devicePixelRatio || 1);
  let w = 0, h = 180;
  const sags = [4, -3, 5, -4, 3];
  // per thread pull state: the finger's offset from the thread's top anchor
  const pull = items.map(() => ({ x: 0, y: 0, on: false }));
  let active = -1, startY = 0, startX = 0, moved = false, opened = false;
  let raf = 0, t0 = performance.now(), running = false;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const xAt = (i: number) => w * (0.1 + 0.2 * i);
  const draw = () => {
    const reduced = motionReduced();
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'butt';
    for (let i = 0; i < 5; i++) {
      const x = xAt(i);
      const p = pull[i];
      const sway = reduced ? 0 : Math.sin((t / 7) * Math.PI * 2 + i * 1.3) * 2;
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.on || p.y > 0.5 ? INDIGO : DEEP;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      if (p.y > 0.5 || p.on) {
        // the thread stretches toward the finger and back to its foot
        const fx = x + p.x, fy = Math.min(h - 20, p.y);
        ctx.quadraticCurveTo(x + p.x * 0.5, fy * 0.5, fx, fy);
        ctx.quadraticCurveTo(fx, fy + (h - fy) * 0.5, x, h - 14);
      } else {
        ctx.quadraticCurveTo(x + sags[i] + sway, h * 0.5, x, h - 14);
      }
      ctx.stroke();
      // the knot at the foot of each thread
      ctx.save();
      ctx.translate(x - 9, h - 26); ctx.scale(0.75, 0.75);
      ctx.lineWidth = 2.4; ctx.strokeStyle = INDIGO;
      ctx.stroke(KNOT_PATH);
      ctx.restore();
    }
    // a faint weft across the band's foot, the pass line
    ctx.strokeStyle = PALE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h - 14); ctx.lineTo(w, h - 14); ctx.stroke();
  };
  const loop = () => { if (!running) return; draw(); raf = requestAnimationFrame(loop); };
  const start = () => { if (running || motionReduced()) { draw(); return; } running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const io = new IntersectionObserver((entries) => { for (const e of entries) { if (e.isIntersecting && !document.hidden) start(); else stop(); } }, { threshold: 0.1 });
  io.observe(root);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(() => { if (motionReduced()) { stop(); draw(); } else start(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });

  const openCard = (i: number) => {
    const it = items[i]; if (!it) return;
    cardThread.textContent = it.thread; cardHeadline.textContent = it.headline; cardSummary.textContent = it.summary; cardChip.textContent = it.chip;
    card.dataset.thread = it.key;
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('is-open'));
    root.querySelectorAll<HTMLElement>('.hm-hero__mobile-labels li').forEach((li) => li.classList.toggle('is-on', li.dataset.thread === it.key));
  };
  const closeCard = () => {
    card.classList.remove('is-open');
    const hide = () => { card.hidden = true; };
    if (motionReduced()) hide(); else setTimeout(hide, DUR.base);
    root.querySelectorAll<HTMLElement>('.hm-hero__mobile-labels li').forEach((li) => li.classList.remove('is-on'));
  };
  cardClose.addEventListener('click', closeCard);
  const nearest = (x: number) => { let best = -1, d = 28; for (let i = 0; i < 5; i++) { const dd = Math.abs(x - xAt(i)); if (dd < d) { d = dd; best = i; } } return best; };
  const springBack = (i: number) => {
    const p = pull[i]; const fx = p.x, fy = p.y; p.on = false;
    if (motionReduced()) { p.x = 0; p.y = 0; draw(); return; }
    tween(DUR.base, KNOT, (v) => { p.x = fx * (1 - v); p.y = fy * (1 - v); if (!running) draw(); });
  };
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = nearest(e.clientX - r.left);
    if (i < 0) return;
    active = i; startY = e.clientY; startX = e.clientX; moved = false; opened = false;
    pull[i].on = true; pull[i].x = 0; pull[i].y = Math.max(1, e.clientY - r.top);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (active < 0) return;
    const r = canvas.getBoundingClientRect();
    const dy = e.clientY - startY, dx = e.clientX - startX;
    if (Math.abs(dy) > 6 || Math.abs(dx) > 6) moved = true;
    const p = pull[active];
    p.x = Math.max(-40, Math.min(40, dx * 0.6));
    p.y = Math.max(1, e.clientY - r.top);
    if (dy > 40 && !opened) { opened = true; openCard(active); }
    if (!running) draw();
  });
  const release = () => {
    if (active < 0) return;
    const i = active; active = -1;
    if (!moved && !opened) openCard(i);   // a tap opens the card too
    springBack(i);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  resize();
  start();
}
