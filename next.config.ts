import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /spec and /roadmap are served as static HTML from public/spec.html and
  // public/roadmap.html. They were originally wired up as redirects (307
  // /spec → /spec.html), but Next's Link prefetcher follows the redirect
  // destination and appends ?_rsc=… to request the server-components
  // payload — which a static HTML file does not have, so every prefetch
  // emitted a 404 in devtools and wasted a round trip. Rewriting instead
  // of redirecting makes /spec the canonical URL: no client-visible
  // redirect, no destination rewrite, no prefetch mismatch. The HTML
  // files are served unchanged from /public.
  //
  // A future content rewrite (tracked in docs/bcd-arc.md follow-ups)
  // will replace these rewrites with first-class App Router pages; for
  // now the structural conversion preserves v3 content exactly while
  // removing the prefetch noise.
  async rewrites() {
    return [
      { source: '/spec', destination: '/spec.html' },
      { source: '/roadmap', destination: '/roadmap.html' },
    ]
  },
};

export default nextConfig;
