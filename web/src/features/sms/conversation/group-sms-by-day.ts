import type { SmsMessage } from "@/lib/api/types";

export type SmsDayGroup = {
  /** Local calendar date, e.g. "2026-10-25". */
  dayKey: string;
  dayLabel: string;
  smsMessages: SmsMessage[];
};

const millisecondsPerDay = 86_400_000;

function readLocalDayKey(timestamp: Date): string {
  const monthNumber = String(timestamp.getMonth() + 1).padStart(2, "0");
  const dayNumber = String(timestamp.getDate()).padStart(2, "0");

  return `${timestamp.getFullYear()}-${monthNumber}-${dayNumber}`;
}

function describeDay(dayStart: Date, now: Date): string {
  const todayKey = readLocalDayKey(now);
  const yesterdayKey = readLocalDayKey(
    new Date(now.getTime() - millisecondsPerDay),
  );
  const dayKey = readLocalDayKey(dayStart);

  if (dayKey === todayKey) {
    return "Today";
  }
  if (dayKey === yesterdayKey) {
    return "Yesterday";
  }

  return dayStart.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Splits a conversation (oldest first) into day sections for the separators. */
export function groupSmsByDay(
  smsMessagesOldestFirst: SmsMessage[],
  now: Date = new Date(),
): SmsDayGroup[] {
  const dayGroups: SmsDayGroup[] = [];

  for (const smsMessage of smsMessagesOldestFirst) {
    const createdAt = new Date(smsMessage.created_at);
    const dayKey = readLocalDayKey(createdAt);
    const currentGroup = dayGroups.at(-1);

    if (currentGroup?.dayKey === dayKey) {
      currentGroup.smsMessages.push(smsMessage);
      continue;
    }

    dayGroups.push({
      dayKey,
      dayLabel: describeDay(createdAt, now),
      smsMessages: [smsMessage],
    });
  }

  return dayGroups;
}
