import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import path from "node:path";
import { modules } from "./data/curriculum/modules";

/** Local MDX plugins must be absolute paths: @next/mdx resolves plugin strings relative to each MDX file. */
const localPlugin = (file: string) => path.join(process.cwd(), "lib", "mdx", file);

const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy: everything comes from this site, except what Firebase sign-in and sync need.
 * - Scripts: this site, Google's sign-in helper (apis.google.com) and reCAPTCHA for App Check (www.google.com,
 *   www.gstatic.com). 'unsafe-inline' stays because the pages are prerendered (no per-request nonce) and Next.js
 *   and the theme script run inline; dev also needs 'unsafe-eval' for React's dev tools and Turbopack.
 * - Requests: Firebase Authentication, token refresh, Firestore and App Check (plus the dev reload socket).
 * - Frames: Firebase's sign-in helper (on this site via /__/auth, or <project>.firebaseapp.com on localhost) and
 *   reCAPTCHA. Nothing may frame this site.
 * Firebase's own pages under /__/ are excluded (they keep Firebase's headers), like the other headers below.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://www.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.google.com${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' https://*.firebaseapp.com https://www.google.com https://recaptcha.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Lessons live at /learn/<module>/<slug>. The old /learn/<slug> addresses (bookmarks, shared links) redirect there
  // permanently; /learn/<module> goes to that module on the roadmap. A slug that is also a module id (the "scaling"
  // lesson in the "scaling" module) is a lesson first, as it always was.
  async redirects() {
    const lessonSlugs = new Set(modules.flatMap((m) => m.lessons));
    return [
      ...modules.flatMap((m) => m.lessons.map((slug) => ({ source: `/learn/${slug}`, destination: `/learn/${m.id}/${slug}`, permanent: true }))),
      ...modules.filter((m) => !lessonSlugs.has(m.id)).map((m) => ({ source: `/learn/${m.id}`, destination: `/learn#${m.id}`, permanent: false })),
    ];
  },
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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
