/** The trailer's dark theme (docs/plan/23-promotional-video.md, Look and feel). */
export const trailerPalette = {
  canvas: "#0d1117",
  surface: "#161b22",
  surfaceRaised: "#1c2128",
  surfaceSunken: "#0f141a",
  border: "#30363d",
  borderSoft: "rgba(48, 54, 61, 0.6)",
  text: "#e6edf3",
  textMuted: "rgba(230, 237, 243, 0.62)",
  textFaint: "rgba(230, 237, 243, 0.38)",
  accent: "#7ccfbd",
  accentSoft: "rgba(124, 207, 189, 0.14)",
  success: "#56d364",
  successSoft: "rgba(86, 211, 100, 0.14)",
  amber: "#e3b341",
  danger: "#f85149",
};

/** One calm hue per event area, used on chips and dots. */
export const areaColors = {
  email: "#7ccfbd",
  sms: "#79c0ff",
  verify: "#d2a8ff",
  http: "#ffa657",
  payment: "#e3b341",
  checkout: "#f0883e",
  webhook: "#56d4dd",
  test: "#8b949e",
};

export type EventArea = keyof typeof areaColors;
