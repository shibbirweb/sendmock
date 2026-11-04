import { describe, expect, test } from "vitest";

import type { AppSettings, OpenRecord } from "@/lib/api/types";
import { buildDefaultSettings } from "@/mocks/fixtures/settings-fixtures";
import { recordMockOpen } from "@/mocks/opens/record-mock-open";

function buildUnopenedMessage() {
  return { id: "01EMAIL", open_count: 0, opened_at: null as string | null };
}

function settingsWith(settingsChange: Partial<AppSettings>): AppSettings {
  return { ...buildDefaultSettings(), ...settingsChange };
}

describe("recordMockOpen", () => {
  test("EM-11.1 a view counts once with the first-open setting", () => {
    const openableMessage = buildUnopenedMessage();
    const messageOpens = new Map<string, OpenRecord[]>();

    const firstView = recordMockOpen(
      openableMessage,
      { source: "ui" },
      buildDefaultSettings(),
      messageOpens,
    );
    const repeatedView = recordMockOpen(
      openableMessage,
      { source: "ui" },
      buildDefaultSettings(),
      messageOpens,
    );

    expect(firstView?.isFirstOpen).toBe(true);
    expect(repeatedView).toBeNull();
    expect(openableMessage.open_count).toBe(1);
    expect(messageOpens.get("01EMAIL")).toHaveLength(1);
  });

  test("EM-11.2 every view counts with the every-open setting", () => {
    const openableMessage = buildUnopenedMessage();
    const everyOpen = settingsWith({ opened_event_mode: "every_open" });
    const messageOpens = new Map<string, OpenRecord[]>();

    recordMockOpen(openableMessage, { source: "ui" }, everyOpen, messageOpens);
    const secondView = recordMockOpen(
      openableMessage,
      { source: "ui" },
      everyOpen,
      messageOpens,
    );

    expect(secondView?.isFirstOpen).toBe(false);
    expect(openableMessage.open_count).toBe(2);
  });

  test("EM-11.4 with auto-fire off only manual and API opens count", () => {
    const openableMessage = buildUnopenedMessage();
    const autoFireOff = settingsWith({ fire_opened_events_on_view: false });
    const messageOpens = new Map<string, OpenRecord[]>();

    const view = recordMockOpen(
      openableMessage,
      { source: "ui" },
      autoFireOff,
      messageOpens,
    );
    const apiOpen = recordMockOpen(
      openableMessage,
      { user_agent: " curl/8.7.1 " },
      autoFireOff,
      messageOpens,
    );

    expect(view).toBeNull();
    expect(apiOpen?.openRecord).toMatchObject({
      source: "api",
      user_agent: "curl/8.7.1",
    });
    expect(openableMessage.opened_at).toBe(apiOpen?.openRecord.opened_at);
  });
});
