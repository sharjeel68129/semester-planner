// No Gemini. Renders a made-up outline to a PNG, like a photo of a printed page, for live/picture-outline.mjs. Argument: where to write it.
import { createRequire } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { ImageResponse } = await import(pathToFileURL(require.resolve("next/dist/compiled/@vercel/og/index.node.js")).href);
const React = require("react");
const h = React.createElement;

const lines = [
  "AMA1702 Applied Mathematics II   Semester 1, 2026/27",
  "Lecture: Mon 08:30-10:20, Weeks 1-13. No lecture in Week 8.",
  "Tutorial: Thu 12:30-13:20, Weeks 2-13",
  "",
  "Assessment",
  "Weekly exercises (in tutorial)          10%",
  "Test 1 (Week 6, in the Monday lecture)  15%",
  "Test 2 (Week 11, in the Monday lecture) 15%",
  "Final Examination                       60%",
  "Total                                  100%",
];
const res = new ImageResponse(
  h("div", { style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fbfaf7", padding: 40, fontSize: 22, color: "#222" } },
    lines.map((line, i) => h("div", { key: i, style: { display: "flex", height: 34, whiteSpace: "pre" } }, line || " "))),
  { width: 900, height: 460 },
);
fs.writeFileSync(process.argv[2], Buffer.from(await res.arrayBuffer()));
console.log("wrote", process.argv[2]);
