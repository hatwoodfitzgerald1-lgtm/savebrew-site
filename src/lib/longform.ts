// The long form copy, parsed by scripts/build-longform.mjs from /home/claude/savebrew/spec/copy.
// Bodies are verbatim; bodyHtml is marked's rendering of the markdown.
import aboutJson from '../data/about.json';
import roundupJson from '../data/roundup.json';
import briefJson from '../data/brief.json';
import guidesJson from '../data/guides.json';
import movesJson from '../data/moves.json';

export interface BriefItem { thread: string; key: string; headline: string; summary: string; chip: string | null }
export interface BriefDay { weekday: string; date: string; label: string; items: BriefItem[]; reusesYesterday?: boolean }
export interface Guide {
  title: string; slug: string; thread: string; dek: string; reading_minutes: number; date: string;
  pull_thread: string; membership_line: string; button_label: string; url: string; h1: string;
  graphic: string; photoSlot: string; wordCount: number; bodyMarkdown: string; bodyHtml: string;
  sections: { heading: string | null; html: string; paragraphs: string[] }[];
  pullThreadParagraphIndex: number; disclaimer: string | null; button: string | null; membershipLine: string | null;
}
export interface RoundupMove {
  name: string; thread: string; headline: string; span: string; spanNote: string;
  paragraphs: { kind: 'body' | 'arithmetic' | 'worth'; text: string }[]; wordCount: number;
}
export interface MoveCandidate {
  id: string; thread: string; headline: string; minutes: number; why: string; skip_if: string; weights: number[];
}

export const about = aboutJson as typeof aboutJson;
export const roundup = roundupJson as unknown as typeof roundupJson & { moves: RoundupMove[] };
export const brief = briefJson as unknown as {
  threads: { name: string; key: string }[];
  today: { date: string; dateShort: string; weekday: string; published: string; publishedTime: string; items: BriefItem[] };
  yesterday: BriefDay;
  lastWeek: { from: string; to: string; year: number; roundupDate: string; days: BriefDay[]; matrix: (BriefItem & { day: string; weekday: string; date: string })[][] };
  thisWeek: { from: string; to: string; days: BriefDay[] };
};
export const guides = guidesJson as unknown as Guide[];
export const moves = movesJson as unknown as {
  week_of: string; note: string; toggle_order: string[]; editors_order: string[]; candidates: MoveCandidate[];
};

export function guideBySlug(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}
export function guidesForThread(thread: string): Guide[] {
  return guides.filter((g) => g.thread.toLowerCase() === thread.toLowerCase());
}
