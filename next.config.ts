import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import path from "node:path";

/** Local MDX plugins must be absolute paths: @next/mdx resolves plugin strings relative to each MDX file. */
const localPlugin = (file: string) => path.join(process.cwd(), "lib", "mdx", file);

const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Firebase's sign-in pages (Google pop-up, email links) served from this site, so networks that block
  // firebaseapp.com still allow sign-in. lib/cloud/config.ts points deployed sites here; docs/accounts.md.
  async rewrites() {
    if (!/^[a-z0-9-]+$/.test(firebaseProject)) return [];
    const firebase = `https://${firebaseProject}.firebaseapp.com`;
    return [
      { source: "/__/auth/:path*", destination: `${firebase}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${firebase}/__/firebase/:path*` },
    ];
  },
  // Basic hardening for every page. No COOP header: Google sign-in uses a pop-up that must talk back to the page.
  // Firebase's pages under /__/ keep their own headers (its sign-in helper must load in a frame on this site).
  async headers() {
    return [
      {
        source: "/:path((?!__/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({
  options: {
    // Plugins are given as strings so Turbopack can load them (functions can't cross into Rust).
    remarkPlugins: ["remark-gfm", localPlugin("remark-acronyms.mjs")],
    rehypePlugins: [
      [
        "@shikijs/rehype",
        { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, fallbackLanguage: "text" },
      ],
    ],
  },
});

export default withMDX(nextConfig);
