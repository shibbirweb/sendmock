import { IconButton } from "@/components/common/icon-button";
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
        <IconButton
          key={communityLink.key}
          label={communityLink.label}
          hint={communityLink.hint}
          tooltipSide="top"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          asChild
        >
          <a
            href={communityLink.href ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            <communityLink.Icon />
          </a>
        </IconButton>
      ))}
    </nav>
  );
}
