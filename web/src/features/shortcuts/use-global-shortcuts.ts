import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { listAllNavigationItems } from "@/features/navigation/navigation-items";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";
import { isTypingInEditableElement } from "@/features/shortcuts/is-typing-in-editable-element";
import { useTheme } from "@/features/theme/theme-provider";

/** How long after pressing "g" the second key of a navigation shortcut is accepted. */
const navigationSequenceTimeoutMs = 1000;

/**
 * Registers the app-wide keyboard shortcuts: command palette, shortcut help,
 * theme switching and the "g then key" navigation sequences.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { setCommandPaletteOpen, setShortcutHelpOpen } = useAppOverlays();
  const { cycleThemePreference } = useTheme();
  const navigationSequenceStartedAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    const navigationPathsByKey = new Map(
      listAllNavigationItems()
        .filter((navigationItem) => navigationItem.shortcutKey !== undefined)
        .map((navigationItem) => [
          navigationItem.shortcutKey ?? "",
          navigationItem.path,
        ]),
    );

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      const isModifierPressed = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
      const pressedKey = keyboardEvent.key.toLowerCase();

      if (isModifierPressed && pressedKey === "k") {
        keyboardEvent.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (
        isModifierPressed ||
        keyboardEvent.altKey ||
        keyboardEvent.repeat ||
        isTypingInEditableElement(keyboardEvent.target)
      ) {
        return;
      }

      const sequenceStartedAt = navigationSequenceStartedAt.current;
      const isNavigationSequenceActive =
        sequenceStartedAt !== null &&
        Date.now() - sequenceStartedAt < navigationSequenceTimeoutMs;
      navigationSequenceStartedAt.current = null;

      if (isNavigationSequenceActive) {
        const targetPath = navigationPathsByKey.get(pressedKey);
        if (targetPath !== undefined) {
          keyboardEvent.preventDefault();
          void navigate({ to: targetPath });
        }
        return;
      }

      if (pressedKey === "g") {
        navigationSequenceStartedAt.current = Date.now();
        return;
      }

      if (keyboardEvent.key === "?") {
        keyboardEvent.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }

      if (pressedKey === "t") {
        cycleThemePreference();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    navigate,
    setCommandPaletteOpen,
    setShortcutHelpOpen,
    cycleThemePreference,
  ]);
}
