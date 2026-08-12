import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/employee",
        // These carry single-use tokens in the URL — not sensitive if
        // crawled after expiry, but no reason to ever let a crawler cache
        // or surface a link containing one.
        "/setup-password",
        "/reset-password",
      ],
    },
    sitemap: "https://skyveon.com/sitemap.xml",
  };
}
