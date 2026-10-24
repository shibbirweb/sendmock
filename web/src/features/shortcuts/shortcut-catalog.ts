import { listAllNavigationItems } from "@/features/navigation/navigation-items";

export type ShortcutDescription = {
  keys: string[];
  description: string;
  // List shortcuts (J, K, Enter, D, /) are added with the list screens in U1.
  group: "General" | "Navigation";
};

const generalShortcuts: ShortcutDescription[] = [
  { keys: ["Mod", "K"], description: "Open command palette", group: "General" },
  { keys: ["?"], description: "Show keyboard shortcuts", group: "General" },
  { keys: ["T"], description: "Switch theme", group: "General" },
  { keys: ["Mod", "B"], description: "Toggle sidebar", group: "General" },
];

/** Every shortcut shown in the help dialog, navigation built from the sidebar list. */
export function listShortcutDescriptions(): ShortcutDescription[] {
  const navigationShortcuts = listAllNavigationItems()
    .filter((navigationItem) => navigationItem.shortcutKey !== undefined)
    .map((navigationItem) => ({
      keys: ["G", (navigationItem.shortcutKey ?? "").toUpperCase()],
      description: `Go to ${navigationItem.title}`,
      group: "Navigation" as const,
    }));

  return [...generalShortcuts, ...navigationShortcuts];
}
