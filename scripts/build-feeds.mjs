#!/usr/bin/env node
// Writes the two static RSS files from the long form JSON (run after build-longform): public/roundup/feed.xml
// and public/guides/feed.xml. Files with extensions never go through the catch all, so these serve as static
// assets on Webflow Cloud; /roundup.xml is the same Roundup feed as a server route (src/pages/roundup.xml.ts).
import fs from 'node:fs';
import path from 'node:path';
import { roundupFeed, guidesFeed } from './feed-xml.mjs';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));
const out = (rel, xml) => { const p = path.join(ROOT, 'public', rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, xml); console.log('build-feeds: wrote public/' + rel); };
out('roundup/feed.xml', roundupFeed(read('roundup.json')));
out('guides/feed.xml', guidesFeed(read('guides.json')));
