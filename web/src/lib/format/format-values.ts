const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

const relativeTimeSteps: {
  unit: Intl.RelativeTimeFormatUnit;
  seconds: number;
}[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

/** "just now", "5 minutes ago", "yesterday", ... */
export function formatRelativeTime(
  isoTimestamp: string,
  nowMs: number = Date.now(),
): string {
  const elapsedSeconds = Math.round(
    (nowMs - new Date(isoTimestamp).getTime()) / 1000,
  );

  if (Math.abs(elapsedSeconds) < 45) {
    return "just now";
  }

  for (const relativeTimeStep of relativeTimeSteps) {
    if (Math.abs(elapsedSeconds) >= relativeTimeStep.seconds) {
      return relativeTimeFormatter.format(
        -Math.round(elapsedSeconds / relativeTimeStep.seconds),
        relativeTimeStep.unit,
      );
    }
  }

  return relativeTimeFormatter.format(
    -Math.round(elapsedSeconds / 60),
    "minute",
  );
}

/** Full local date and time, for tooltips and detail headers. */
export function formatDateTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

const byteUnits = ["B", "KB", "MB", "GB"];

/** 1536 -> "1.5 KB". */
export function formatBytes(sizeBytes: number): string {
  let scaledSize = sizeBytes;
  let unitIndex = 0;

  while (scaledSize >= 1024 && unitIndex < byteUnits.length - 1) {
    scaledSize /= 1024;
    unitIndex += 1;
  }

  const roundedSize =
    unitIndex === 0 ? scaledSize : Math.round(scaledSize * 10) / 10;

  return `${roundedSize} ${byteUnits[unitIndex] ?? "B"}`;
}

/** 184 -> "184 ms", 5004 -> "5.0 s". */
export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}
