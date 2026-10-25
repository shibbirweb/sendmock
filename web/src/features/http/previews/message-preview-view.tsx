import { DiscordMessagePreview } from "@/features/http/previews/discord-message-preview";
import { PushNotificationPreview } from "@/features/http/previews/push-notification-preview";
import { SlackMessagePreview } from "@/features/http/previews/slack-message-preview";
import type { MessagePreview } from "@/lib/http/message-preview-types";

/** The renderer for each recognised payload (HC-03.2). */
export function MessagePreviewView({
  messagePreview,
}: {
  messagePreview: MessagePreview;
}) {
  if (messagePreview.previewKind === "slack") {
    return <SlackMessagePreview slackMessage={messagePreview} />;
  }
  if (messagePreview.previewKind === "discord") {
    return <DiscordMessagePreview discordMessage={messagePreview} />;
  }

  return <PushNotificationPreview pushMessage={messagePreview} />;
}
