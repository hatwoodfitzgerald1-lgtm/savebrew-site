// Inlines a kit SVG (imported with ?raw at build time) without its embedded <style>, so the site's own
// CSS drives the draw in animations and honours prefers-reduced-motion and data-motion="reduced".
export interface InlineOptions {
  class?: string;
  label?: string;          // an accessible name; omitted means decorative (aria-hidden)
  width?: number | string;
  height?: number | string;
  attrs?: Record<string, string>;
  preserveAspectRatio?: string;
}
export function inlineSvg(raw: string, opts: InlineOptions = {}): string {
  let svg = raw.replace(/<\?xml[^>]*>\s*/i, '').trim();
  svg = svg.replace(/<style[\s\S]*?<\/style>\s*/gi, '');
  const open = svg.match(/^<svg[^>]*>/i);
  if (!open) return svg;
  let tag = open[0];
  const strip = (name: string) => { tag = tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'i'), ''); };
  strip('width'); strip('height'); strip('role'); strip('aria-label'); strip('class'); strip('preserveAspectRatio');
  const attrs: string[] = [];
  if (opts.width != null) attrs.push(`width="${opts.width}"`);
  if (opts.height != null) attrs.push(`height="${opts.height}"`);
  if (opts.class) attrs.push(`class="${opts.class}"`);
  if (opts.preserveAspectRatio) attrs.push(`preserveAspectRatio="${opts.preserveAspectRatio}"`);
  if (opts.label) attrs.push(`role="img" aria-label="${opts.label.replace(/"/g, '&quot;')}"`);
  else attrs.push('aria-hidden="true" focusable="false"');
  for (const [k, v] of Object.entries(opts.attrs || {})) attrs.push(`${k}="${v}"`);
  tag = tag.replace(/^<svg/i, '<svg ' + attrs.join(' '));
  return tag + svg.slice(open[0].length);
}
