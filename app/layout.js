import { Crimson_Pro, Atkinson_Hyperlegible } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import CookieNotice from "./cookie-notice";
import LinkLanding from "./link-landing";
import "./globals.css";

// Self-hosted by Next at build time, so no font request leaves the student's browser.
const crimson = Crimson_Pro({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-crimson" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

// Defaults for every page; a page sets its own `title` and `description` on top of these.
// The share image and icons come from app/opengraph-image.js, app/icon.svg and app/apple-icon.js.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${crimson.variable} ${atkinson.variable}`}>
      <body>
        {children}
        <LinkLanding />
        <CookieNotice />
        {/* Page-view counts in the Vercel dashboard. Sets no cookies. Does nothing until switched on there. */}
        <Analytics />
      </body>
    </html>
  );
}
