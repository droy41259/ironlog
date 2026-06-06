import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com wss://*.firebaseio.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

// Set by `npm run build:native` (scripts/build-native.mjs). When true we emit a
// fully static site into `out/` that gets bundled inside the Capacitor
// Android/iOS shells. The normal `next build` (web/server deploy) is untouched.
const isNative = process.env.BUILD_TARGET === "native";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isNative
    ? {
        output: "export",
        // No Next.js image optimizer server exists inside the bundled app.
        images: { unoptimized: true },
        // Emit `route/index.html` per page so the in-app WebView resolves
        // deep paths to a real file.
        trailingSlash: true,
      }
    : {
        // Security headers are a server feature and don't apply to the
        // statically-exported native bundle, so only attach them for web.
        async headers() {
          return [{ source: "/(.*)", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
