import { SITE_URL } from "@/lib/site";

/** /sitemap.xml: the public pages. Add a new public page here when one is made. */
export default function sitemap() {
  return ["/", "/signup", "/login", "/privacy", "/terms", "/contact"].map((path) => ({ url: `${SITE_URL}${path}` }));
}
