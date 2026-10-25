import { CircleHelpIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommunityLinks } from "@/features/help/use-community-links";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";

/** Documentation, shortcuts, what's new, feedback and the repository (UI-10.1). */
export function HelpMenu() {
  const communityLinks = useCommunityLinks();
  const { setShortcutHelpOpen } = useAppOverlays();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help">
          <CircleHelpIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {communityLinks.map((communityLink) => (
          <Fragment key={communityLink.key}>
            {communityLink.key === "bug" && <DropdownMenuSeparator />}
            {communityLink.key === "star" && <DropdownMenuSeparator />}
            {communityLink.href === null ? (
              <DropdownMenuItem onSelect={() => setShortcutHelpOpen(true)}>
                <communityLink.Icon />
                {communityLink.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <a
                  href={communityLink.href}
                  target="_blank"
                  rel="noreferrer"
                  title={communityLink.hint}
                >
                  <communityLink.Icon />
                  {communityLink.label}
                </a>
              </DropdownMenuItem>
            )}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
