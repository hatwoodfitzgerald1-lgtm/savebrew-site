// The ranker's logic (Art Direction 3.21, design document 7.10): client side and deterministic, shared by the
// server render (the editors' order at first paint) and the browser (src/scripts/ranker.ts). No DOM here.
//   score = (8 minus the candidate's position in editors_order, the first position being 1)
//         + the sum of its weights for the toggles that are on
//   ties are broken by fewer minutes, then by the editors' order; the top four are shown ranked, the rest
//   sit beneath greyed, each with the reason it ranked lower: the moves.lower.N line for the heaviest
//   toggle in its weight vector that is off, or moves.lower.default when no toggle is on (or when no off
//   toggle carries any weight for it).
export interface Candidate {
  id: string;
  thread: string;
  headline: string;
  minutes: number;
  why: string;
  skip_if: string;
  weights: number[];
}
export interface MovesData {
  week_of: string;
  toggle_order: string[];
  editors_order: string[];
  candidates: Candidate[];
}
export interface RankedCandidate {
  candidate: Candidate;
  /** 1 based position in the editors' order */
  position: number;
  /** the deterministic score */
  score: number;
  /** 1 based rank in the result */
  rank: number;
  /** true for the ranked four */
  shown: boolean;
  /** 1 to 6, the moves.lower.N reason for a candidate that ranked lower; null means moves.lower.default */
  reason: number | null;
}
export interface RankResult {
  ranked: RankedCandidate[];
  top: RankedCandidate[];
  rest: RankedCandidate[];
  /** the minutes of the ranked four added up */
  minutes: number;
  /** how many toggles are on */
  on: number;
  shown: number;
  total: number;
}

export const SHOWN = 4;
export const BASE = 8;

export function position(data: MovesData, id: string): number {
  const i = data.editors_order.indexOf(id);
  return i < 0 ? data.editors_order.length + 1 : i + 1;
}

export function score(data: MovesData, c: Candidate, toggles: boolean[]): number {
  let s = BASE - position(data, c.id);
  for (let i = 0; i < c.weights.length; i++) if (toggles[i]) s += c.weights[i] || 0;
  return s;
}

/** The moves.lower.N index (1 to 6) for the heaviest toggle in the weight vector that is off, or null for the default line. */
export function reasonFor(c: Candidate, toggles: boolean[]): number | null {
  if (!toggles.some(Boolean)) return null;
  let best = -1;
  let weight = 0;
  for (let i = 0; i < c.weights.length; i++) {
    if (toggles[i]) continue;
    const w = c.weights[i] || 0;
    if (w > weight) { weight = w; best = i; }
  }
  return best < 0 ? null : best + 1;
}

export function rank(data: MovesData, toggles: boolean[]): RankResult {
  const on = toggles.filter(Boolean).length;
  const scored = data.candidates.map((c) => ({ candidate: c, position: position(data, c.id), score: score(data, c, toggles) }));
  scored.sort((a, b) => b.score - a.score || a.candidate.minutes - b.candidate.minutes || a.position - b.position);
  const ranked: RankedCandidate[] = scored.map((s, i) => ({
    ...s,
    rank: i + 1,
    shown: i < SHOWN,
    reason: i < SHOWN ? null : reasonFor(s.candidate, toggles)
  }));
  const top = ranked.slice(0, SHOWN);
  const rest = ranked.slice(SHOWN);
  return { ranked, top, rest, minutes: top.reduce((m, r) => m + r.candidate.minutes, 0), on, shown: top.length, total: ranked.length };
}

/** The ranked order as ids, for the page scene and the aria description. */
export function order(data: MovesData, toggles: boolean[]): string[] {
  return rank(data, toggles).ranked.map((r) => r.candidate.id);
}

/** The clipboard text: the four ranked headlines with their minutes, under the print title, with the note. */
export function listText(result: RankResult, strings: { title: string; minutes: string; note: string }): string {
  const lines = result.top.map((r) => `${r.candidate.headline} (${strings.minutes.replace('{minutes}', String(r.candidate.minutes))})`);
  return [strings.title, '', ...lines, '', strings.note].join('\n');
}
