import { Crimson_Pro, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

// Self-hosted by Next at build time, so no font request leaves the student's browser.
const crimson = Crimson_Pro({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-crimson" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata = { title: "AI Semester Planner" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${crimson.variable} ${atkinson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
