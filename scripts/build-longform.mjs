#!/usr/bin/env node
// Parses the long form copy (about.md, roundup.md, brief_items.md, guides/*.md, moves.json) from
// /home/claude/savebrew/spec/copy into JSON under src/data. Rerunnable; runs before every build.
// Bodies are kept verbatim; markdown is rendered to HTML with marked (no smart punctuation, so no
// dash or quote is ever introduced).
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const COPY = process.env.SB_COPY_DIR || '/home/claude/savebrew/spec/copy';
const OUT = path.resolve(new URL('..', import.meta.url).pathname, 'src/data');
fs.mkdirSync(OUT, { recursive: true });
marked.setOptions({ gfm: true, breaks: false });

const DISCLAIMER = /^SaveBrew is an educational digest, not financial advice\./;
const read = (f) => fs.readFileSync(path.join(COPY, f), 'utf8').replace(/\r\n/g, '\n');
const paragraphs = (text) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const html = (md) => marked.parse(md).trim();
const write = (name, data) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1));
  console.log(`build-longform: wrote ${name}`);
};

// ------------------------------------------------------------------ guides
function parseGuide(file) {
  const src = read(path.join('guides', file));
  const fm = {};
  const fence = src.match(/^```yaml\n([\s\S]*?)\n```\n/);
  if (!fence) throw new Error(`no yaml fence in ${file}`);
  for (const line of fence[1].split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1);
    else if (/^\d+$/.test(v)) v = Number(v);
    fm[m[1]] = v;
  }
  let body = src.slice(fence[0].length).trim();
  const h1 = body.match(/^# (.+)\n/);
  if (h1) body = body.slice(h1[0].length).trim();
  const paras = paragraphs(body);
  // peel the trailing disclaimer, the Button line and the membership line, which the build renders itself
  const tail = { disclaimer: null, button: null, membershipLine: null };
  while (paras.length) {
    const last = paras[paras.length - 1];
    if (DISCLAIMER.test(last)) { tail.disclaimer = last; paras.pop(); continue; }
    if (/^Button:\s*/.test(last)) { tail.button = last.replace(/^Button:\s*/, ''); paras.pop(); continue; }
    if (fm.membership_line && last === fm.membership_line) { tail.membershipLine = last; paras.pop(); continue; }
    break;
  }
  // sections: the intro (before the first ##) then each question heading with its paragraphs
  const sections = [];
  let current = { heading: null, paragraphs: [] };
  for (const p of paras) {
    const h = p.match(/^## (.+)$/);
    if (h) { sections.push(current); current = { heading: h[1].trim(), paragraphs: [] }; }
    else current.paragraphs.push(p);
  }
  sections.push(current);
  const bodyMarkdown = paras.join('\n\n');
  const slug = fm.slug;
  const needle = (fm.pull_thread || '').replace(/[.:;,]\s*$/, '');
  const pullIndex = paras.findIndex((p) => needle && p.includes(needle));
  return {
    ...fm,
    url: `/guides/${slug}`,
    h1: h1 ? h1[1].trim() : fm.title,
    graphic: `/assets/kit/guide-graphics/${slug}.svg`,
    photoSlot: `photo.guide-hero.${slug}`,
    wordCount: words(bodyMarkdown),
    bodyMarkdown,
    bodyHtml: html(bodyMarkdown),
    sections: sections.map((s) => ({ heading: s.heading, html: html(s.paragraphs.join('\n\n')), paragraphs: s.paragraphs })),
    pullThreadParagraphIndex: pullIndex,
    ...tail
  };
}
const guideFiles = fs.readdirSync(path.join(COPY, 'guides')).filter((f) => f.endsWith('.md')).sort();
const guides = guideFiles.map(parseGuide);
// the order the site lists them (art direction 3.24)
const guideOrder = ['make-a-rotating-category-pay', 'the-national-average-is-a-warning', 'four-percent-against-the-account-you-have', 'why-patio-furniture-is-cheap-in-october'];
guides.sort((a, b) => guideOrder.indexOf(a.slug) - guideOrder.indexOf(b.slug));
write('guides.json', guides);

// ------------------------------------------------------------------ about
{
  const src = read('about.md');
  const heading = (src.match(/^Heading pass:\s*(.+)$/m) || [])[1] || 'Who checks the threads?';
  const bodyStart = src.indexOf('## The About copy');
  const chosenStart = src.indexOf('## "How items are chosen"');
  const whereStart = src.indexOf('## "Where we are"');
  let body = src.slice(bodyStart, chosenStart).replace(/^## The About copy\s*/, '').trim();
  const paras = paragraphs(body);
  let button = null;
  if (/^Button:/.test(paras[paras.length - 1])) button = paras.pop().replace(/^Button:\s*/, '');
  const bodyMarkdown = paras.join('\n\n');
  const chosen = src.slice(chosenStart, whereStart);
  const variants = chosen.split(/^SHIP (?:ONLY )?IF THE OWNER (?:CONFIRMS|DOES NOT CONFIRM).*$/m).slice(1);
  const chosenHeading = (chosen.match(/^### (.+)$/m) || [])[1] || 'How are items chosen?';
  const clean = (t) => paragraphs(t.replace(/^### .+$/m, '')).join('\n\n');
  const where = src.slice(whereStart);
  const whereHeading = (where.match(/^Heading:\s*(.+)$/m) || [])[1] || 'Where are we?';
  const hours = (where.match(/^Support hours \(proposed\):\s*(.+)$/m) || [])[1] || '';
  write('about.json', {
    heading,
    wordCount: words(bodyMarkdown.replace(/^#+ .+$/gm, '')),
    bodyMarkdown,
    bodyHtml: html(bodyMarkdown),
    button,
    chosen: {
      heading: chosenHeading,
      noReferralFees: { markdown: clean(variants[0] || ''), html: html(clean(variants[0] || '')) },
      noClaim: { markdown: clean(variants[1] || ''), html: html(clean(variants[1] || '')) },
      note: 'Ship noReferralFees only on the owner\'s confirmation (offering spec 17.4); otherwise ship noClaim.'
    },
    where: {
      heading: whereHeading,
      entity: 'SaveBrew Inc.',
      street: '660 American Ave',
      city: 'King Of Prussia, PA 19406',
      phone: '(888) 338 8809',
      phoneHref: 'tel:+18883388809',
      email: 'support@savebrew.com',
      hours: hours.split('. ')[0].replace(/\.$/, ''),
      hoursLine: hours
    }
  });
}

// ------------------------------------------------------------------ roundup
{
  const src = read('roundup.md');
  const get = (re) => (src.match(re) || [])[1] || '';
  const stable = get(/^Stable address for this issue:\s*(\S+)$/m);
  const movesBlock = src.slice(src.indexOf('## The three moves'), src.indexOf('## Where the tracked rates ended the week'));
  const moves = movesBlock.split(/^### /m).slice(1).map((chunk) => {
    const title = chunk.split('\n')[0];
    const spanText = (title.match(/\((.+)\)/) || [])[1] || '';
    const spanMap = { 'spans columns one to two': 'span-2', 'spans column three': 'span-1', 'spans columns four to five': 'span-2' };
    const rest = chunk.slice(title.length);
    const thread = (rest.match(/^Thread:\s*(.+)$/m) || [])[1];
    const headline = (rest.match(/^Headline:\s*(.+)$/m) || [])[1];
    const paras = paragraphs(rest).filter((p) => !/^Thread:|^Headline:/.test(p));
    return {
      name: title.replace(/\s*\(.+\)\s*$/, ''),
      thread, headline,
      span: spanMap[spanText] || 'span-1',
      spanNote: spanText,
      paragraphs: paras.map((p) => ({
        kind: /^The arithmetic:/.test(p) ? 'arithmetic' : /^Worth doing/.test(p) ? 'worth' : 'body',
        text: p
      })),
      wordCount: words(paras.join(' '))
    };
  });
  const table = (src.match(/```\n([\s\S]*?)\n```/) || [])[1] || '';
  const rows = table.split('\n').slice(1).map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length >= 4)
    .map(([account, product, apy, change]) => {
      const dir = /^up/.test(change) ? 'up' : /^down/.test(change) ? 'down' : 'unchanged';
      return { account, product, apy, change, direction: dir, moved: dir !== 'unchanged' };
    });
  const past = [];
  const pastBlock = src.slice(src.indexOf('## Past Saturdays'));
  for (const line of pastBlock.split('\n')) {
    const m = line.match(/^(Saturday, [A-Za-z]+ \d+, \d{4}):\s*(.+?)\s*\(this issue, (\S+)\)\s*$/);
    if (m) past.push({ date: m[1], title: m[2], url: m[3], current: true });
  }
  write('roundup.json', {
    slug: stable.replace('/roundup/', ''),
    stableUrl: stable,
    rssDescription: get(/^RSS description:\s*(.+)$/m),
    heading: get(/^Heading:\s*(.+)$/m),
    date: get(/^Date:\s*(.+)$/m),
    covers: get(/^Covers:\s*(.+)$/m),
    disclaimer: get(/^Disclaimer \(beside the date, verbatim\):\s*(.+)$/m),
    moves,
    rates: {
      heading: get(/^Heading pass:\s*(.+)$/m),
      intro: get(/^Set as a small table[^\n]*\n\n?((?:Illustrative)[^\n]*)$/m) || 'Illustrative accounts and rates, from the Friday, September 18, 6:00 AM ET check; six of the twenty tracked.',
      columns: (table.split('\n')[0] || '').split('|').map((c) => c.trim()),
      rows,
      line: get(/^Line beneath the table:\s*(.+)$/m)
    },
    past: { heading: get(/^Heading: (Past Saturdays)$/m) || 'Past Saturdays', entries: past, note: get(/^(New roundups are added here[^\n]*)$/m) }
  });
}

// ------------------------------------------------------------------ brief items
{
  const src = read('brief_items.md');
  const THREADS = ['Rates', 'Cashback', 'Coupons', 'Seasonal', 'Paycheck'];
  const key = (t) => t.toLowerCase();
  function items(block) {
    const out = [];
    const re = /^Thread:\s*(.+)\nHeadline:\s*(.+)\nSummary:\s*(.+)(?:\nChip:\s*(.+))?/gm;
    let m;
    while ((m = re.exec(block))) out.push({ thread: m[1].trim(), key: key(m[1].trim()), headline: m[2].trim(), summary: m[3].trim(), chip: m[4] ? m[4].trim() : null });
    return out;
  }
  const section = (title) => {
    const i = src.indexOf(title);
    if (i < 0) throw new Error('missing section ' + title);
    const rest = src.slice(i + title.length);
    const next = rest.search(/^## /m);
    return next < 0 ? rest : rest.slice(0, next);
  };
  const todayBlock = section('## TODAY,');
  const yesterdayBlock = section("## YESTERDAY'S PASS,");
  const weekBlock = section("## LAST WEEK'S PASS,");
  const soFarBlock = section('## THIS WEEK SO FAR,');
  const days = (block) => block.split(/^### /m).slice(1).map((chunk) => {
    const dateLine = chunk.split('\n')[0].trim();
    const [weekday] = dateLine.split(', ');
    return { weekday, date: dateLine, label: `${weekday} ${dateLine.match(/\d+/)[0]}`, items: items(chunk) };
  });
  const yesterday = { weekday: 'Wednesday', date: 'Wednesday, September 23, 2026', label: 'Wednesday 23', items: items(yesterdayBlock) };
  const soFar = days(soFarBlock).map((d) => (d.items.length ? d : { ...d, items: yesterday.items, reusesYesterday: true }));
  const lastWeek = days(weekBlock);
  const today = items(todayBlock);
  const check = (list, name) => { if (list.length !== 5) console.warn(`build-longform: ${name} has ${list.length} items, expected 5`); };
  check(today, 'today'); check(yesterday.items, 'yesterday'); lastWeek.forEach((d) => check(d.items, d.date)); soFar.forEach((d) => check(d.items, d.date));
  write('brief.json', {
    threads: THREADS.map((t) => ({ name: t, key: key(t) })),
    today: { date: 'Thursday, September 24, 2026', dateShort: 'Thu, Sep 24', weekday: 'Thursday', published: 'Published 6:30 AM ET', publishedTime: '6:30 AM ET', items: today },
    yesterday,
    lastWeek: { from: 'Monday, September 14', to: 'Friday, September 18', year: 2026, roundupDate: 'Saturday, September 19, 2026', days: lastWeek,
      matrix: lastWeek.map((d) => d.items.map((it) => ({ day: d.label, weekday: d.weekday, date: d.date, ...it }))) },
    thisWeek: { from: 'Monday, September 21', to: 'Wednesday, September 23', days: soFar }
  });
}

// ------------------------------------------------------------------ the ranker candidates
{
  const moves = JSON.parse(read('moves.json'));
  write('moves.json', moves);
}
