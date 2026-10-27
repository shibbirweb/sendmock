import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCommunityLinks } from "@/features/help/use-community-links";

/** The Help menu links that sit in the sidebar footer, as icons. */
const sidebarLinkKeys = ["docs", "bug", "feature", "security", "star"];

/**
 * Star, docs and feedback links above the connection status, so they are one
 * click away on every screen. Hidden when the sidebar is collapsed to icons.
 */
export function SidebarCommunityLinks() {
  const communityLinks = useCommunityLinks();
  const sidebarLinks = communityLinks.filter(
    (communityLink) =>
      sidebarLinkKeys.includes(communityLink.key) &&
      communityLink.href !== null,
  );

  return (
    <nav
      aria-label="Project links"
      className="flex items-center gap-0.5 px-1 group-data-[collapsible=icon]:hidden"
    >
      {sidebarLinks.map((communityLink) => (
        <Tooltip key={communityLink.key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              asChild
            >
              <a
                href={communityLink.href ?? undefined}
                target="_blank"
                rel="noreferrer"
                aria-label={communityLink.label}
              >
                <communityLink.Icon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {communityLink.hint === undefined
              ? communityLink.label
              : `${communityLink.label}. ${communityLink.hint}`}
          </TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}
