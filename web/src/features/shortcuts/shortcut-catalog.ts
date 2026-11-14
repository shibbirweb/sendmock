import { listAllNavigationItems } from "@/features/navigation/navigation-items";

export type ShortcutDescription = {
  keys: string[];
  description: string;
  group: "General" | "Navigation" | "Lists and messages";
};

/**
 * Shortcuts by name, so an icon's tooltip shows the same keys the help dialog
 * lists (UI-13.2).
 */
export const appShortcuts = {
  openCommandPalette: {
    keys: ["Mod", "K"],
    description: "Open command palette",
    group: "General",
  },
  showShortcuts: {
    keys: ["?"],
    description: "Show keyboard shortcuts",
    group: "General",
  },
  switchTheme: { keys: ["T"], description: "Switch theme", group: "General" },
  toggleSidebar: {
    keys: ["Mod", "B"],
    description: "Toggle sidebar",
    group: "General",
  },
  openNextItem: {
    keys: ["J"],
    description: "Open the next email or conversation",
    group: "Lists and messages",
  },
  openPreviousItem: {
    keys: ["K"],
    description: "Open the previous email or conversation",
    group: "Lists and messages",
  },
  focusSearch: {
    keys: ["/"],
    description: "Search the list",
    group: "Lists and messages",
  },
  deleteOpenItem: {
    keys: ["D"],
    description: "Delete the open email",
    group: "Lists and messages",
  },
  replyAsRecipient: {
    keys: ["R"],
    description: "Reply as the recipient",
    group: "Lists and messages",
  },
  replyAllAsRecipient: {
    keys: ["Shift", "R"],
    description: "Reply all as the recipient",
    group: "Lists and messages",
  },
  forwardAsRecipient: {
    keys: ["F"],
    description: "Forward as the recipient",
    group: "Lists and messages",
  },
} satisfies Record<string, ShortcutDescription>;

export type AppShortcutName = keyof typeof appShortcuts;

/** Every shortcut shown in the help dialog, navigation built from the sidebar list. */
export function listShortcutDescriptions(): ShortcutDescription[] {
  const navigationShortcuts = listAllNavigationItems()
    .filter((navigationItem) => navigationItem.shortcutKey !== undefined)
    .map((navigationItem) => ({
      keys: ["G", (navigationItem.shortcutKey ?? "").toUpperCase()],
      description: `Go to ${navigationItem.title}`,
      group: "Navigation" as const,
    }));

  return [...Object.values(appShortcuts), ...navigationShortcuts];
}
