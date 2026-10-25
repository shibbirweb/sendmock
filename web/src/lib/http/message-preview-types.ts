export type SlackBlockPreview =
  | { blockKind: "header"; text: string }
  | { blockKind: "section"; text: string | null; fields: string[] }
  | { blockKind: "divider" }
  | { blockKind: "context"; texts: string[] }
  | { blockKind: "actions"; buttonLabels: string[] };

export type DiscordEmbedPreview = {
  authorName: string | null;
  title: string | null;
  description: string | null;
  /** `#5865f2`, from the embed's integer colour. */
  colorHex: string | null;
  fields: { name: string; value: string; isInline: boolean }[];
  footerText: string | null;
};

export type PushNotificationPreview = {
  service: "FCM" | "Expo" | "OneSignal";
  title: string;
  body: string;
  /** Device token, topic or player id, shortened by the UI. */
  target: string | null;
};

/** A recognised payload, rendered like the real service shows it (HC-03.2). */
export type MessagePreview =
  | { previewKind: "slack"; text: string | null; blocks: SlackBlockPreview[] }
  | {
      previewKind: "discord";
      username: string | null;
      content: string | null;
      embeds: DiscordEmbedPreview[];
    }
  | { previewKind: "push"; notifications: PushNotificationPreview[] };
