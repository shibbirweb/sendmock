import { describe, expect, test } from "vitest";

import { filterSmsThreads } from "@/features/sms/threads/filter-sms-threads";
import type { SmsMessage, SmsThread } from "@/lib/api/types";

function buildThread(
  contactNumber: string,
  lastMessageBody: string,
  channel: SmsThread["channel"] = "sms",
): SmsThread {
  return {
    thread_id: `+15550001111|${contactNumber}`,
    app_number: "+15550001111",
    contact_number: contactNumber,
    channel,
    last_message: { body: lastMessageBody } as SmsMessage,
    message_count: 1,
    unread_count: 0,
  };
}

const ukThread = buildThread("+447700900123", "YES");
const whatsappThread = buildThread(
  "whatsapp:+8801722222222",
  "Can you deliver after 5pm?",
  "whatsapp",
);
const allThreads = [ukThread, whatsappThread];

describe("filterSmsThreads", () => {
  test("keeps every thread when there is no filter", () => {
    expect(
      filterSmsThreads(allThreads, { searchText: "", channel: null }),
    ).toEqual(allThreads);
  });

  test("matches a number typed with spaces and dashes", () => {
    expect(
      filterSmsThreads(allThreads, {
        searchText: "7700 900-123",
        channel: null,
      }),
    ).toEqual([ukThread]);
  });

  test("matches the digits of a WhatsApp address", () => {
    expect(
      filterSmsThreads(allThreads, { searchText: "+880172", channel: null }),
    ).toEqual([whatsappThread]);
  });

  test("matches the latest message text, ignoring case", () => {
    expect(
      filterSmsThreads(allThreads, { searchText: "DELIVER", channel: null }),
    ).toEqual([whatsappThread]);
  });

  test("keeps only the chosen channel", () => {
    expect(
      filterSmsThreads(allThreads, { searchText: "", channel: "whatsapp" }),
    ).toEqual([whatsappThread]);
  });

  test("combines the channel and the search text", () => {
    expect(
      filterSmsThreads(allThreads, { searchText: "YES", channel: "whatsapp" }),
    ).toEqual([]);
  });
});
