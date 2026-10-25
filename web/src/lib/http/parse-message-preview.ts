import type { CapturedHttpRequest, HttpBinPreset } from "@/lib/api/types";
import type {
  DiscordEmbedPreview,
  MessagePreview,
  PushNotificationPreview,
  SlackBlockPreview,
} from "@/lib/http/message-preview-types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Slack text objects are `{ type, text }`; plain strings are allowed too. */
function readTextObject(value: unknown): string | null {
  return isRecord(value) ? readText(value.text) : readText(value);
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The JSON body, or Slack's legacy `payload=` form field. */
function parsePayload(capturedRequest: CapturedHttpRequest): unknown {
  try {
    return JSON.parse(capturedRequest.body) as unknown;
  } catch {
    const formPayload = new URLSearchParams(capturedRequest.body).get(
      "payload",
    );
    try {
      return formPayload === null ? null : (JSON.parse(formPayload) as unknown);
    } catch {
      return null;
    }
  }
}

function hasOnlyKeys(payload: JsonRecord, knownKeys: string[]): boolean {
  return Object.keys(payload).every((payloadKey) =>
    knownKeys.includes(payloadKey),
  );
}

const slackKeys = [
  "text",
  "blocks",
  "attachments",
  "username",
  "icon_emoji",
  "icon_url",
  "channel",
  "mrkdwn",
  "thread_ts",
  "unfurl_links",
];

function toSlackBlock(block: unknown): SlackBlockPreview[] {
  if (!isRecord(block)) {
    return [];
  }
  if (block.type === "header") {
    const headerText = readTextObject(block.text);
    return headerText === null
      ? []
      : [{ blockKind: "header", text: headerText }];
  }
  if (block.type === "section") {
    return [
      {
        blockKind: "section",
        text: readTextObject(block.text),
        fields: readArray(block.fields)
          .map(readTextObject)
          .filter((fieldText): fieldText is string => fieldText !== null),
      },
    ];
  }
  if (block.type === "divider") {
    return [{ blockKind: "divider" }];
  }
  if (block.type === "context") {
    const texts = readArray(block.elements)
      .map(readTextObject)
      .filter((contextText): contextText is string => contextText !== null);
    return [{ blockKind: "context", texts }];
  }
  if (block.type === "actions") {
    const buttonLabels = readArray(block.elements)
      .map((element) =>
        isRecord(element) ? readTextObject(element.text) : null,
      )
      .filter((buttonLabel): buttonLabel is string => buttonLabel !== null);
    return [{ blockKind: "actions", buttonLabels }];
  }

  return [];
}

function parseSlack(
  payload: unknown,
  isPresetKnown: boolean,
): MessagePreview | null {
  if (!isRecord(payload)) {
    return null;
  }
  const blocks = readArray(payload.blocks);
  const text = readText(payload.text);
  const looksLikeSlack =
    blocks.length > 0 || (text !== null && hasOnlyKeys(payload, slackKeys));
  if (!looksLikeSlack && !isPresetKnown) {
    return null;
  }

  return { previewKind: "slack", text, blocks: blocks.flatMap(toSlackBlock) };
}

const discordKeys = [
  "content",
  "username",
  "avatar_url",
  "tts",
  "embeds",
  "allowed_mentions",
  "components",
  "flags",
];

function toDiscordEmbed(embed: unknown): DiscordEmbedPreview[] {
  if (!isRecord(embed)) {
    return [];
  }

  return [
    {
      authorName: isRecord(embed.author) ? readText(embed.author.name) : null,
      title: readText(embed.title),
      description: readText(embed.description),
      colorHex:
        typeof embed.color === "number"
          ? `#${embed.color.toString(16).padStart(6, "0")}`
          : null,
      fields: readArray(embed.fields).flatMap((field) =>
        isRecord(field) && readText(field.name) !== null
          ? [
              {
                name: readText(field.name) ?? "",
                value: readText(field.value) ?? "",
                isInline: field.inline === true,
              },
            ]
          : [],
      ),
      footerText: isRecord(embed.footer) ? readText(embed.footer.text) : null,
    },
  ];
}

function parseDiscord(
  payload: unknown,
  isPresetKnown: boolean,
): MessagePreview | null {
  if (!isRecord(payload)) {
    return null;
  }
  const embeds = readArray(payload.embeds);
  const content = readText(payload.content);
  const looksLikeDiscord =
    embeds.length > 0 ||
    (content !== null && hasOnlyKeys(payload, discordKeys));
  if (!looksLikeDiscord && !isPresetKnown) {
    return null;
  }

  return {
    previewKind: "discord",
    username: readText(payload.username),
    content,
    embeds: embeds.flatMap(toDiscordEmbed),
  };
}

function toFcmNotification(payload: JsonRecord): PushNotificationPreview[] {
  const message = isRecord(payload.message) ? payload.message : null;
  const notification =
    message !== null && isRecord(message.notification)
      ? message.notification
      : null;
  if (message === null || notification === null) {
    return [];
  }

  return [
    {
      service: "FCM",
      title: readText(notification.title) ?? "",
      body: readText(notification.body) ?? "",
      target: readText(message.token) ?? readText(message.topic),
    },
  ];
}

function toExpoNotifications(payload: unknown): PushNotificationPreview[] {
  const expoMessages = Array.isArray(payload) ? payload : [payload];

  return expoMessages.flatMap((expoMessage) =>
    isRecord(expoMessage) &&
    expoMessage.to !== undefined &&
    (readText(expoMessage.title) !== null ||
      readText(expoMessage.body) !== null)
      ? [
          {
            service: "Expo" as const,
            title: readText(expoMessage.title) ?? "",
            body: readText(expoMessage.body) ?? "",
            target: readText(expoMessage.to),
          },
        ]
      : [],
  );
}

function toOneSignalNotification(
  payload: JsonRecord,
): PushNotificationPreview[] {
  if (!isRecord(payload.contents)) {
    return [];
  }
  const headings = isRecord(payload.headings) ? payload.headings : {};
  const playerIds = readArray(payload.include_player_ids);

  return [
    {
      service: "OneSignal",
      title: readText(headings.en) ?? "",
      body: readText(payload.contents.en) ?? "",
      target: readText(playerIds[0]),
    },
  ];
}

function parsePush(payload: unknown): MessagePreview | null {
  const notifications = [
    ...(isRecord(payload) ? toFcmNotification(payload) : []),
    ...toExpoNotifications(payload),
    ...(isRecord(payload) ? toOneSignalNotification(payload) : []),
  ];

  return notifications.length === 0
    ? null
    : { previewKind: "push", notifications };
}

const pushPresets: (HttpBinPreset | null)[] = ["fcm", "expo", "onesignal"];

/**
 * A preview for Slack, Discord and push payloads (HC-03.2): the bin's
 * preset decides when it is one of those, else the payload's shape. Null
 * when nothing is recognised.
 */
export function parseMessagePreview(
  capturedRequest: CapturedHttpRequest,
  binPreset: HttpBinPreset | null,
): MessagePreview | null {
  const payload = parsePayload(capturedRequest);
  if (payload === null) {
    return null;
  }
  if (binPreset === "slack") {
    return parseSlack(payload, true);
  }
  if (binPreset === "discord") {
    return parseDiscord(payload, true);
  }
  if (pushPresets.includes(binPreset)) {
    return parsePush(payload);
  }

  return (
    parseSlack(payload, false) ??
    parseDiscord(payload, false) ??
    parsePush(payload)
  );
}
