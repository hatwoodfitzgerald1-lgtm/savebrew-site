// The two RSS feeds (design document 7.4 and 7.5), built from the long form JSON. Used by scripts/build-feeds.mjs
// (which writes the static files public/roundup/feed.xml and public/guides/feed.xml) and by the server route
// src/pages/roundup.xml.ts (the same Roundup feed at /roundup.xml). No dashes in any string here.
const SITE = 'https://savebrew.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso, hour = 7) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00-04:00`).toUTCString();

export function roundupFeed(roundup) {
  const link = SITE + roundup.stableUrl;
  const summary = roundup.moves.map((m) => `${m.thread}: ${m.headline}`).join('. ') + '.';
  const body = roundup.moves.map((m) => `<h3>${esc(m.thread)}: ${esc(m.headline)}</h3>` + m.paragraphs.map((p) => `<p>${esc(p.text)}</p>`).join('')).join('') + `<p>${esc(roundup.rates.line)}</p><p>${esc(roundup.disclaimer)}</p>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>The Weekly Roundup from SaveBrew</title>
    <link>${SITE}/roundup</link>
    <atom:link href="${SITE}/roundup/feed.xml" rel="self" type="application/rss+xml" />
    <description>${esc(roundup.rssDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(roundup.slug)}</lastBuildDate>
    <item>
      <title>${esc(roundup.past?.entries?.[0]?.title || roundup.heading)} ${esc(roundup.date)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(roundup.slug)}</pubDate>
      <description>${esc(summary)}</description>
      <content:encoded><![CDATA[${body}]]></content:encoded>
    </item>
  </channel>
</rss>
`;
}

export function guidesFeed(guides) {
  const items = guides.map((g) => `    <item>
      <title>${esc(g.title)}</title>
      <link>${SITE}${g.url}</link>
      <guid isPermaLink="true">${SITE}${g.url}</guid>
      <pubDate>${rfc822(g.date)}</pubDate>
      <category>${esc(g.thread)}</category>
      <description>${esc(g.dek)}</description>
      <content:encoded><![CDATA[${g.bodyHtml}<p>${esc(g.disclaimer || '')}</p>]]></content:encoded>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>The Guides from SaveBrew</title>
    <link>${SITE}/guides</link>
    <atom:link href="${SITE}/guides/feed.xml" rel="self" type="application/rss+xml" />
    <description>Evergreen explainers on saving money from SaveBrew, each under the thread it belongs to. Free to read, in any order.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(guides[0]?.date || '2026-09-24')}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}
