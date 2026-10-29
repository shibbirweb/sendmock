import { staticFile } from "remotion";

/** Brand colours, shared with the app and website (web/src/index.css). */
export const brandColors = {
  teal: "#0d9488",
  emerald: "#10b981",
  tealLight: "#2dd4bf",
  emeraldLight: "#34d399",
  night: "#06110f",
  nightRaised: "#0c1f1b",
  ink: "#0a0a0a",
  paper: "#fafafa",
  mutedText: "#94a3b8",
  danger: "#f43f5e",
  warning: "#f59e0b",
};

export const brandGradient = `linear-gradient(135deg, ${brandColors.teal}, ${brandColors.emerald})`;

/** For highlighted words: bright enough to read over the brand glow too. */
export const highlightGradient = "linear-gradient(135deg, #5eead4, #a7f3d0)";
export const highlightShadow = "drop-shadow(0 2px 14px rgba(0, 0, 0, 0.55))";

export const fontFamily =
  "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif";
export const monoFontFamily =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Geist, loaded from the package itself so the render needs no network. */
export const fontFaceCss = `@font-face {
  font-family: "Geist";
  src: url("${staticFile("fonts/geist.woff2")}") format("woff2");
  font-weight: 100 900;
  font-display: block;
}`;

export const videoFps = 30;
export const videoWidth = 1920;
export const videoHeight = 1080;
