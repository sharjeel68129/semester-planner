import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

// The picture shown when the site's link is pasted into a chat or a social post.
export const alt = `${SITE_NAME}: every deadline in your course outlines, on one calendar.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#6b1026",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 700 }}>{SITE_NAME}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.1 }}>Every deadline in your course outlines, on one calendar.</div>
          <div style={{ marginTop: 32, fontSize: 36, color: "#f1dce1" }}>It never guesses a date.</div>
        </div>
      </div>
    ),
    size,
  );
}
