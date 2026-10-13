import type { NextConfig } from "next";

// Sent with every response. No script-src: a nonce-based CSP would make every
// page render per request (no static shells); these rules need no nonce.
const SECURITY_HEADERS = [
	// Not inside anyone's frame (clickjacking); no plugins; forms only post here.
	{
		key: "Content-Security-Policy",
		value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
	},
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	// The scan screen needs the camera; nothing needs the rest.
	{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The label studio is the app for now.
  async redirects() {
    return [
      // An email link that lands on the home page (Supabase falls back to its
      // Site URL when the link's return address isn't on its allowed list)
      // still finishes signing in: the code goes on to /auth/confirm.
      {
        source: "/",
        has: [{ type: "query", key: "code" }],
        destination: "/auth/confirm?next=/labels",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "token_hash" }],
        destination: "/auth/confirm?next=/labels",
        permanent: false,
      },
      { source: "/", destination: "/labels", permanent: false },
      // No email for now: admins make accounts with a temporary password and
      // reset forgotten ones in People and access.
      { source: "/signup", destination: "/login", permanent: false },
      { source: "/forgot-password", destination: "/login", permanent: false },
    ];
  },
  cacheComponents: true,
  experimental: {
    // Label pictures are uploaded one at a time, up to 5 MB each.
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
