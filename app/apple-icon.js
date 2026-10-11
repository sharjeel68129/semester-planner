import { ImageResponse } from "next/og";

// The icon a phone uses when the site is added to the home screen: the same calendar mark as app/icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#6b1026" }}>
        <div style={{ width: 112, height: 104, display: "flex", flexDirection: "column", borderRadius: 14, background: "#ffffff", overflow: "hidden" }}>
          <div style={{ height: 28, background: "#f1dce1" }} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 700, color: "#6b1026" }}>7</div>
        </div>
      </div>
    ),
    size,
  );
}
