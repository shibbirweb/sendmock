export type GraphSurroundings = {
  canvas: HTMLCanvasElement;
  spotlight: HTMLElement;
  /** Whether to watch the spotlight at all; touch screens and reduced motion never breathe. */
  shouldWatchSpotlight: boolean;
  onResize: () => void;
  onThemeChange: () => void;
  onSpotlightChange: () => void;
};

/**
 * Watches what the graph depends on: the canvas size (its pixels follow the rendered size
 * times the pixel ratio, so squares stay crisp), the theme (the `dark` class on <html> or the
 * system scheme), and the spotlight's inline style, rewritten as the pointer moves. Returns a
 * cleanup that stops watching.
 */
export function observeGraphSurroundings({
  canvas,
  spotlight,
  shouldWatchSpotlight,
  onResize,
  onThemeChange,
  onSpotlightChange,
}: GraphSurroundings): () => void {
  const resizeObserver = new ResizeObserver(() => {
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * pixelRatio);
    canvas.height = Math.round(canvas.clientHeight * pixelRatio);
    onResize();
  });
  resizeObserver.observe(canvas);

  const themeObserver = new MutationObserver(onThemeChange);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", onThemeChange);

  const spotlightObserver = new MutationObserver(onSpotlightChange);
  if (shouldWatchSpotlight) {
    spotlightObserver.observe(spotlight, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  return () => {
    spotlightObserver.disconnect();
    themeObserver.disconnect();
    colorSchemeQuery.removeEventListener("change", onThemeChange);
    resizeObserver.disconnect();
  };
}
