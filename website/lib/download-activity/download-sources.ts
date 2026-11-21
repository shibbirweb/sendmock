import { addDays, toUtcIsoDate } from "./utc-days";

/** Downloads per UTC day, keyed by `YYYY-MM-DD`. */
export type DailyDownloads = Record<string, number>;

export type DownloadSourceKey = "npm" | "crates" | "pypi";

/** Each source's days; a source that could not be read is left out. */
export type DownloadSources = Partial<
  Record<DownloadSourceKey, DailyDownloads>
>;

/** A registry that publishes SendMock's downloads per day. */
export type DownloadSource = {
  key: DownloadSourceKey;
  /** Whether a browser may read it (it sends `Access-Control-Allow-Origin`). */
  isBrowserReadable: boolean;
  buildUrl: (today: Date) => string;
  /** The days in the registry's answer, or null when it is not the expected shape. */
  parseDailyDownloads: (registryAnswer: unknown) => DailyDownloads | null;
};

/** Platform packages and library crates come along with these, so they would count twice. */
export const npmPackageNames = ["sendmock", "sendmock-testcontainers"];
/** npm's newest day can lag a day or two behind, so the range reaches back further than 7 days. */
const npmRangeDayCount = 10;

type RegistryDay = { day?: unknown; date?: unknown; downloads?: unknown };

function addRegistryDays(
  dailyDownloads: DailyDownloads,
  registryDays: unknown,
  readDate: (registryDay: RegistryDay) => unknown,
): boolean {
  if (!Array.isArray(registryDays)) {
    return false;
  }
  for (const registryDay of registryDays as RegistryDay[]) {
    const date = readDate(registryDay ?? {});
    const downloads = registryDay?.downloads ?? null;
    if (typeof date === "string" && typeof downloads === "number") {
      dailyDownloads[date] = (dailyDownloads[date] ?? 0) + downloads;
    }
  }
  return true;
}

/** npm's bulk answer: `{ "<package>": { downloads: [{ day, downloads }] } | null }`. */
function parseNpmRange(registryAnswer: unknown): DailyDownloads | null {
  if (typeof registryAnswer !== "object" || registryAnswer === null) {
    return null;
  }
  const dailyDownloads: DailyDownloads = {};
  const answerByPackage = registryAnswer as Record<string, unknown>;
  let hasPackage = false;
  for (const packageName of npmPackageNames) {
    const packageDays =
      (answerByPackage[packageName] as { downloads?: unknown } | null)
        ?.downloads ?? null;
    hasPackage =
      addRegistryDays(
        dailyDownloads,
        packageDays,
        (registryDay) => registryDay.day,
      ) || hasPackage;
  }
  return hasPackage ? dailyDownloads : null;
}

/** crates.io: `{ version_downloads: [{ date, downloads }], meta: { extra_downloads } }`. */
function parseCratesDownloads(registryAnswer: unknown): DailyDownloads | null {
  const crateAnswer = registryAnswer as {
    version_downloads?: unknown;
    meta?: { extra_downloads?: unknown } | null;
  } | null;
  const dailyDownloads: DailyDownloads = {};
  const hasVersions = addRegistryDays(
    dailyDownloads,
    crateAnswer?.version_downloads ?? null,
    (registryDay) => registryDay.date,
  );
  addRegistryDays(
    dailyDownloads,
    crateAnswer?.meta?.extra_downloads ?? [],
    (registryDay) => registryDay.date,
  );
  return hasVersions ? dailyDownloads : null;
}

/** pypistats: `{ data: [{ category: "without_mirrors", date, downloads }] }`. */
function parsePypiOverall(registryAnswer: unknown): DailyDownloads | null {
  const statsRows = (registryAnswer as { data?: unknown } | null)?.data ?? null;
  if (!Array.isArray(statsRows)) {
    return null;
  }
  const withoutMirrors = statsRows.filter(
    (statsRow) =>
      (statsRow as { category?: unknown } | null)?.category ===
      "without_mirrors",
  );
  const dailyDownloads: DailyDownloads = {};
  addRegistryDays(
    dailyDownloads,
    withoutMirrors,
    (registryDay) => registryDay.date,
  );
  return dailyDownloads;
}

export const downloadSources: readonly DownloadSource[] = [
  {
    key: "npm",
    isBrowserReadable: true,
    buildUrl: (today) => {
      const yesterday = addDays(toUtcIsoDate(today), -1);
      const firstDay = addDays(yesterday, 1 - npmRangeDayCount);
      return `https://api.npmjs.org/downloads/range/${firstDay}:${yesterday}/${npmPackageNames.join(",")}`;
    },
    parseDailyDownloads: parseNpmRange,
  },
  {
    key: "crates",
    isBrowserReadable: true,
    buildUrl: () => "https://crates.io/api/v1/crates/sendmock/downloads",
    parseDailyDownloads: parseCratesDownloads,
  },
  {
    key: "pypi",
    // pypistats sends no Access-Control-Allow-Origin, so only the build reads it.
    isBrowserReadable: false,
    buildUrl: () =>
      "https://pypistats.org/api/packages/sendmock-testcontainers/overall?mirrors=false",
    parseDailyDownloads: parsePypiOverall,
  },
];
