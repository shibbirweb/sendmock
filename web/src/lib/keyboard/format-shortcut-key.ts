const isMacPlatform =
  typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);

/** `Mod` as the platform's modifier (⌘ on macOS, Ctrl elsewhere); other keys as written. */
export function formatShortcutKey(shortcutKey: string): string {
  if (shortcutKey === "Mod") {
    return isMacPlatform ? "⌘" : "Ctrl";
  }

  return shortcutKey;
}

/** The keys as `aria-keyshortcuts` names them, e.g. "Control+B" or "Shift+R". */
export function formatAriaKeyShortcuts(shortcutKeys: string[]): string {
  return shortcutKeys
    .map((shortcutKey) => {
      if (shortcutKey === "Mod") {
        return isMacPlatform ? "Meta" : "Control";
      }

      return shortcutKey;
    })
    .join("+");
}
