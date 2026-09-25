// "Your moves", the ranker (Art Direction 3.21, design document 7.10): six switches re-rank this week's
// candidates with the deterministic score in src/lib/ranker.ts. The DOM ships the editors' order at first
// paint (server rendered); this script wires the switches, re-ranks on every change with GSAP Flip (Knot,
// 0.38s), keeps the state line in an aria-live region, writes the list to the clipboard, opens the print view,
// and tells the page scene the new order through the sb:rank event. Works with motion reduced (no Flip,
// instant reorder) and on a 375 viewport with one thumb. Both variants (the /your-moves page and the home
// embed) run through the same code: data-variant="full" has the greyed rest list, "embed" hides ranks 5 to 7.
import { rank, listText, type MovesData, type RankResult } from '../lib/ranker';
import { motionReduced, DUR } from './ease';

interface Strings {
  empty: string; progress: string; result: string; copyDone: string; copyFailed: string; printDone: string;
  printTitle: string; printNote: string; minutes: string; lower: string[]; lowerDefault: string; on: string; off: string;
}
declare global { interface Window { sbRanker?: { rankers: RankerUI[] } } }

const live = (text: string) => {
  const el = document.getElementById('sb-live');
  if (el) { el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); }
};

export class RankerUI {
  root: HTMLElement;
  data: MovesData;
  S: Strings;
  variant: string;
  toggles: boolean[];
  tracks: HTMLButtonElement[];
  items: Map<string, HTMLElement> = new Map();
  top: HTMLElement;
  rest: HTMLElement | null;
  stateLine: HTMLElement | null;
  result!: RankResult;
  private settle = 0;
  private flipping = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.data = JSON.parse(root.dataset.moves || '{}');
    this.S = JSON.parse(root.dataset.strings || '{}');
    this.variant = root.dataset.variant || 'full';
    this.tracks = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-toggle]'));
    this.toggles = this.data.toggle_order.map(() => false);
    this.top = root.querySelector<HTMLElement>('[data-top]')!;
    this.rest = root.querySelector<HTMLElement>('[data-rest]');
    this.stateLine = root.querySelector<HTMLElement>('[data-state-line]');
    root.querySelectorAll<HTMLElement>('[data-candidate]').forEach((el) => this.items.set(el.dataset.candidate!, el));
    // the switches: the track button is the control (role switch); the whole row is the 44px target
    this.tracks.forEach((track) => {
      const i = Number(track.dataset.toggle);
      const row = track.closest<HTMLElement>('.switch') || track;
      row.addEventListener('click', (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('a')) return;
        if (t !== track) e.preventDefault();
        this.set(i, !this.toggles[i]);
      });
      track.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.set(i, !this.toggles[i]); } });
    });
    root.querySelector('[data-copy]')?.addEventListener('click', () => this.copy());
    root.querySelector('[data-print]')?.addEventListener('click', () => this.print());
    window.addEventListener('afterprint', () => document.body.classList.remove('ranker-print'));
    this.result = rank(this.data, this.toggles);
    this.paint(false);
    root.dataset.rankerReady = '1';
  }

  set(i: number, on: boolean) {
    if (this.toggles[i] === on) return;
    this.toggles[i] = on;
    const track = this.tracks[i];
    track.setAttribute('aria-checked', on ? 'true' : 'false');
    const row = track.closest<HTMLElement>('.switch');
    row?.classList.toggle('is-on', on);
    const state = row?.querySelector<HTMLElement>('[data-toggle-state]');
    if (state) state.textContent = on ? this.S.on : this.S.off;
    this.rerank();
  }

  /** Sets every toggle at once (QA and the embed's deep link). */
  setAll(values: boolean[]) {
    values.forEach((v, i) => {
      if (i >= this.toggles.length || this.toggles[i] === v) return;
      this.toggles[i] = v;
      const track = this.tracks[i];
      track.setAttribute('aria-checked', v ? 'true' : 'false');
      track.closest<HTMLElement>('.switch')?.classList.toggle('is-on', v);
      const state = track.closest<HTMLElement>('.switch')?.querySelector<HTMLElement>('[data-toggle-state]');
      if (state) state.textContent = v ? this.S.on : this.S.off;
    });
    this.rerank();
  }

  private async rerank() {
    this.result = rank(this.data, this.toggles);
    const on = this.result.on > 0;
    // in progress: the count line while the threads re order, then the settled result line
    if (this.stateLine && on) this.stateLine.textContent = this.S.progress.replace('{shown}', String(this.result.shown)).replace('{total}', String(this.result.total));
    this.root.dataset.state = on ? 'progress' : 'empty';
    await this.paint(true);
    clearTimeout(this.settle);
    this.settle = window.setTimeout(() => {
      if (!this.stateLine) return;
      if (this.result.on === 0) { this.stateLine.textContent = this.S.empty; this.root.dataset.state = 'empty'; }
      else { this.stateLine.textContent = this.S.result.replace('{minutes}', String(this.result.minutes)); this.root.dataset.state = 'result'; }
    }, on ? DUR.base + 120 : 0);
  }

  /** Lays the items out in the ranked order; animates the move with Flip unless motion is reduced. */
  private async paint(animate: boolean) {
    const r = this.result;
    const visible = () => Array.from(this.items.values()).filter((el) => !el.hidden);
    let Flip: any = null;
    let state: any = null;
    const useFlip = animate && !motionReduced() && !this.flipping;
    if (useFlip) {
      try { ({ Flip } = await window.sbMotion.loadGsap()); state = Flip.getState(visible(), { props: 'opacity' }); } catch { Flip = null; }
    }
    const place = (rc: (typeof r.ranked)[number]) => {
      const el = this.items.get(rc.candidate.id);
      if (!el) return;
      el.classList.toggle('is-top', rc.shown);
      el.classList.toggle('is-rest', !rc.shown);
      el.dataset.rank = String(rc.rank);
      el.style.setProperty('--rank', String(rc.rank));
      const reason = el.querySelector<HTMLElement>('[data-reason]');
      if (reason) reason.textContent = rc.shown ? '' : (rc.reason ? this.S.lower[rc.reason - 1] : this.S.lowerDefault);
      if (this.variant === 'embed') el.hidden = !rc.shown;
      const parent = rc.shown || !this.rest ? this.top : this.rest;
      parent.appendChild(el);
    };
    r.ranked.forEach(place);
    this.root.dataset.order = r.ranked.map((x) => x.candidate.id).join(' ');
    this.root.dataset.minutes = String(r.minutes);
    document.dispatchEvent(new CustomEvent('sb:rank', { detail: { root: this.root, order: r.ranked.map((x) => x.candidate.id), top: r.top.map((x) => x.candidate.id), on: r.on, minutes: r.minutes, toggles: this.toggles.slice() } }));
    if (Flip && state) {
      this.flipping = true;
      try {
        await Flip.from(state, { duration: DUR.base / 1000, ease: 'knot', absolute: true, nested: true, scale: false, onEnter: (els: Element[]) => window.gsap?.fromTo(els, { opacity: 0 }, { opacity: 1, duration: DUR.base / 1000, ease: 'shuttle' }) }).then();
      } finally { this.flipping = false; }
    }
  }

  async copy() {
    const text = listText(this.result, { title: this.S.printTitle, minutes: this.S.minutes, note: this.S.printNote });
    const done = this.root.querySelector<HTMLElement>('[data-copy-done]');
    const tick = this.root.querySelector<HTMLElement>('[data-copy-tick]');
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch { ok = false; }
    }
    if (done) {
      done.hidden = false;
      done.classList.toggle('is-failed', !ok);
      const text = done.querySelector<HTMLElement>('[data-copy-text]');
      if (text) text.textContent = ok ? this.S.copyDone : this.S.copyFailed;
      if (tick) { tick.classList.remove('is-drawn'); void (tick as any).offsetWidth; tick.classList.toggle('is-drawn', ok); tick.hidden = !ok; }
    }
    live(ok ? this.S.copyDone : this.S.copyFailed);
    this.root.dataset.copied = ok ? 'true' : 'false';
  }

  print() {
    live(this.S.printDone);
    document.body.classList.add('ranker-print');
    setTimeout(() => { try { window.print(); } catch { /* no print in this browser */ } }, 60);
  }
}

function boot() {
  const list: RankerUI[] = [];
  document.querySelectorAll<HTMLElement>('[data-ranker]').forEach((root) => { if (!root.dataset.rankerReady) list.push(new RankerUI(root)); });
  window.sbRanker = window.sbRanker || { rankers: [] };
  window.sbRanker.rankers.push(...list);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
