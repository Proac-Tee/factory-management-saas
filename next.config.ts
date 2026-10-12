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
    return [{ source: "/", destination: "/labels", permanent: false }];
  },
  cacheComponents: true,
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
