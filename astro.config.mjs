// SaveBrew (savebrew.com), the Astro app for Webflow Cloud.
// Webflow Cloud's own Astro starter (github.com/Webflow-Examples/hello-world-astro-minimal) pins
// astro 7 with @astrojs/cloudflare 14 and output: 'server'; the platform injects the same adapter
// version at deploy time and sets the base path from the environment's mount path (mounted at /),
// so no `base` is set here. See CONVENTIONS.md, "Framework and deploy".
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://savebrew.com',
  output: 'server',
  compressHTML: true,
  trailingSlash: 'ignore',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'compile'
  }),
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto'
  }
});
