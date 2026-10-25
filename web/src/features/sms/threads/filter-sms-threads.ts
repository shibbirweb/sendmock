import type { SmsChannel, SmsThread } from "@/lib/api/types";

export type SmsThreadFilters = {
  searchText: string;
  /** `null` shows every channel. */
  channel: SmsChannel | null;
};

function keepDigitsAndPlus(searchedText: string): string {
  return searchedText.replace(/[^\d+]/g, "");
}

function matchesSearchText(smsThread: SmsThread, searchText: string): boolean {
  const normalisedSearch = searchText.trim().toLowerCase();
  if (normalisedSearch === "") {
    return true;
  }

  const searchedNumbers = [smsThread.contact_number, smsThread.app_number];
  const digitSearch = keepDigitsAndPlus(normalisedSearch);
  const matchesNumber =
    digitSearch.length > 0 &&
    searchedNumbers.some((phoneAddress) =>
      keepDigitsAndPlus(phoneAddress).includes(digitSearch),
    );

  return (
    matchesNumber ||
    smsThread.last_message.body.toLowerCase().includes(normalisedSearch)
  );
}

/**
 * Narrows the conversation list by channel and by text found in either
 * number (spaces and dashes ignored) or in the latest message.
 */
export function filterSmsThreads(
  smsThreads: SmsThread[],
  threadFilters: SmsThreadFilters,
): SmsThread[] {
  return smsThreads.filter(
    (smsThread) =>
      (threadFilters.channel === null ||
        smsThread.channel === threadFilters.channel) &&
      matchesSearchText(smsThread, threadFilters.searchText),
  );
}
