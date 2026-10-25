import { describe, expect, test } from "vitest";

import { groupSmsByDay } from "@/features/sms/conversation/group-sms-by-day";
import type { SmsMessage } from "@/lib/api/types";

function buildMessage(smsId: string, createdAt: Date): SmsMessage {
  return { id: smsId, created_at: createdAt.toISOString() } as SmsMessage;
}

const now = new Date(2026, 9, 25, 15, 0);

describe("groupSmsByDay", () => {
  test("labels today and yesterday and keeps the order", () => {
    const dayGroups = groupSmsByDay(
      [
        buildMessage("first", new Date(2026, 9, 24, 9, 0)),
        buildMessage("second", new Date(2026, 9, 24, 23, 59)),
        buildMessage("third", new Date(2026, 9, 25, 0, 1)),
      ],
      now,
    );

    expect(
      dayGroups.map((dayGroup) => ({
        dayLabel: dayGroup.dayLabel,
        smsIds: dayGroup.smsMessages.map((smsMessage) => smsMessage.id),
      })),
    ).toEqual([
      { dayLabel: "Yesterday", smsIds: ["first", "second"] },
      { dayLabel: "Today", smsIds: ["third"] },
    ]);
  });

  test("uses the date for older days", () => {
    const [olderGroup] = groupSmsByDay(
      [buildMessage("older", new Date(2026, 9, 20, 12, 0))],
      now,
    );

    expect(olderGroup?.dayKey).toBe("2026-10-20");
    expect(olderGroup?.dayLabel).not.toMatch(/Today|Yesterday/);
  });

  test("returns no groups for an empty conversation", () => {
    expect(groupSmsByDay([], now)).toEqual([]);
  });
});
