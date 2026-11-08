import type { AppSettings } from "@/lib/api/types";

type RetentionLimits = Pick<
  AppSettings,
  "max_emails" | "max_sms" | "max_age_days"
>;

/**
 * The kinds of traffic nothing bounds: a count limit of 0 with no age limit,
 * so the database grows until the disk is full. Matches the server's startup
 * warning (PL-08.4).
 */
export function listUnboundedTraffic(
  retentionLimits: RetentionLimits,
): string[] {
  if (retentionLimits.max_age_days !== null) {
    return [];
  }
  const countLimits: [string, number][] = [
    ["emails", retentionLimits.max_emails],
    ["SMS", retentionLimits.max_sms],
  ];
  return countLimits
    .filter(([, maxCount]) => maxCount === 0)
    .map(([trafficName]) => trafficName);
}
