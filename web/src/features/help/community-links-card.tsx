import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useCommunityLinks } from "@/features/help/use-community-links";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";

/** The Help menu's links on Settings > About, for people who look there. */
export function CommunityLinksCard() {
  const communityLinks = useCommunityLinks();
  const { setShortcutHelpOpen } = useAppOverlays();

  return (
    <SettingsSectionCard
      title="Help and feedback"
      description="Issue forms open on GitHub with your version, channel, OS and browser filled in; nothing you captured is sent."
    >
      <div className="flex flex-wrap gap-2">
        {communityLinks.map((communityLink) =>
          communityLink.href === null ? (
            <Button
              key={communityLink.key}
              variant="outline"
              size="sm"
              onClick={() => setShortcutHelpOpen(true)}
            >
              <communityLink.Icon />
              {communityLink.label}
            </Button>
          ) : (
            <Button key={communityLink.key} variant="outline" size="sm" asChild>
              <a
                href={communityLink.href}
                target="_blank"
                rel="noreferrer"
                title={communityLink.hint}
              >
                <communityLink.Icon />
                {communityLink.label}
              </a>
            </Button>
          ),
        )}
      </div>
    </SettingsSectionCard>
  );
}
