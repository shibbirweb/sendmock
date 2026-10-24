import { useNavigate } from "@tanstack/react-router";
import { KeyboardIcon, PaletteIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { listAllNavigationItems } from "@/features/navigation/navigation-items";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";
import { useTheme } from "@/features/theme/theme-provider";

export function CommandPalette() {
  const navigate = useNavigate();
  const { isCommandPaletteOpen, setCommandPaletteOpen, setShortcutHelpOpen } =
    useAppOverlays();
  const { cycleThemePreference } = useTheme();

  const runAndClose = (paletteAction: () => void) => {
    setCommandPaletteOpen(false);
    paletteAction();
  };

  return (
    <CommandDialog
      open={isCommandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="Command palette"
      description="Search for a page or an action"
    >
      <CommandInput placeholder="Type a page or an action..." />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go to">
          {listAllNavigationItems().map((navigationItem) => (
            <CommandItem
              key={navigationItem.path + navigationItem.title}
              value={`Go to ${navigationItem.title}`}
              onSelect={() => {
                runAndClose(() => {
                  void navigate({ to: navigationItem.path });
                });
              }}
            >
              <navigationItem.icon />
              {navigationItem.title}
              {navigationItem.shortcutKey !== undefined && (
                <CommandShortcut>
                  G {navigationItem.shortcutKey.toUpperCase()}
                </CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="Switch theme"
            onSelect={() => {
              runAndClose(cycleThemePreference);
            }}
          >
            <PaletteIcon />
            Switch theme
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="Show keyboard shortcuts"
            onSelect={() => {
              runAndClose(() => {
                setShortcutHelpOpen(true);
              });
            }}
          >
            <KeyboardIcon />
            Show keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
