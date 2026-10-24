import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";
import {
  listShortcutDescriptions,
  type ShortcutDescription,
} from "@/features/shortcuts/shortcut-catalog";

const shortcutGroups: ShortcutDescription["group"][] = [
  "General",
  "Navigation",
];

const isMacPlatform =
  typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);

function formatShortcutKey(shortcutKey: string): string {
  if (shortcutKey === "Mod") {
    return isMacPlatform ? "⌘" : "Ctrl";
  }

  return shortcutKey;
}

export function ShortcutHelpDialog() {
  const { isShortcutHelpOpen, setShortcutHelpOpen } = useAppOverlays();
  const shortcutDescriptions = listShortcutDescriptions();

  return (
    <Dialog open={isShortcutHelpOpen} onOpenChange={setShortcutHelpOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts work anywhere except while typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {shortcutGroups.map((shortcutGroup) => (
            <section key={shortcutGroup} className="grid gap-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">
                {shortcutGroup}
              </h3>
              <ul className="grid gap-1.5">
                {shortcutDescriptions
                  .filter(
                    (shortcutDescription) =>
                      shortcutDescription.group === shortcutGroup,
                  )
                  .map((shortcutDescription) => (
                    <li
                      key={shortcutDescription.description}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{shortcutDescription.description}</span>
                      <KbdGroup>
                        {shortcutDescription.keys.map((shortcutKey) => (
                          <Kbd key={shortcutKey}>
                            {formatShortcutKey(shortcutKey)}
                          </Kbd>
                        ))}
                      </KbdGroup>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
