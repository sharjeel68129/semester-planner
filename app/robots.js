import { SITE_URL } from "@/lib/site";

/** /robots.txt: search engines may read the public pages, not the signed-in ones or the API. */
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/settings", "/reset-password", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
