/** @type {import('next').NextConfig} */

// Baseline security headers for every page. frame-ancestors / X-Frame-Options
// stop the admin portal from being embedded (clickjacking); a full script
// CSP is left out since the App Router relies on inline bootstrap scripts.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

function apiImagePattern() {
  const api = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
  return {
    protocol: api.protocol.replace(":", ""),
    hostname: api.hostname,
    port: api.port,
    pathname: "/api/**",
  };
}

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // CMS and course cover images are served by the API; Next's image
    // optimizer resizes them per device and caches them on Vercel's CDN.
    remotePatterns: [apiImagePattern()],
  },
};

export default nextConfig;
