// /roundup.xml: the Weekly Roundup's RSS feed as a server route (the same XML as the static public/roundup/feed.xml).
import type { APIRoute } from 'astro';
import roundup from '../data/roundup.json';
// @ts-ignore plain JS shared with the build script
import { roundupFeed } from '../../scripts/feed-xml.mjs';
export const prerender = false;
export const GET: APIRoute = () => new Response(roundupFeed(roundup), { status: 200, headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
