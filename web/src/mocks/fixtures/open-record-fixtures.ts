import type { OpenRecord } from "@/lib/api/types";

const fixtureUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15";

type OpenedFixtureMessage = {
  id: string;
  open_count: number;
  opened_at: string | null;
};

/**
 * The open history of fixture messages that were opened: the first open at
 * their `opened_at`, later ones a minute apart.
 */
export function buildOpenRecordFixtures(
  openedMessages: OpenedFixtureMessage[],
): Map<string, OpenRecord[]> {
  const messageOpens = new Map<string, OpenRecord[]>();
  openedMessages.forEach((openedMessage) => {
    if (openedMessage.opened_at === null || openedMessage.open_count === 0) {
      return;
    }

    const firstOpenedAtMs = Date.parse(openedMessage.opened_at);
    messageOpens.set(
      openedMessage.id,
      Array.from({ length: openedMessage.open_count }, (_, openIndex) => ({
        opened_at: new Date(firstOpenedAtMs + openIndex * 60_000).toISOString(),
        source: "ui",
        user_agent: fixtureUserAgent,
      })),
    );
  });

  return messageOpens;
}
