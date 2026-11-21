const millisecondsPerDay = 24 * 60 * 60 * 1000;

/** A moment as its UTC date, `YYYY-MM-DD`, the format every registry uses. */
export function toUtcIsoDate(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/** The UTC date `dayCount` days after `isoDate` (before it when negative). */
export function addDays(isoDate: string, dayCount: number): string {
  const moment = new Date(`${isoDate}T00:00:00Z`);
  return toUtcIsoDate(
    new Date(moment.getTime() + dayCount * millisecondsPerDay),
  );
}
