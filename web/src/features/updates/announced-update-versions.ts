const announcedVersionsStorageKey = "sendmock.announced-update-versions";

/** The most versions remembered; older ones are long installed or skipped. */
const maxAnnouncedVersions = 20;

/** Versions already announced in the header bell, kept per browser (PL-05.11). */
export function readAnnouncedUpdateVersions(): string[] {
  try {
    const storedText = localStorage.getItem(announcedVersionsStorageKey);
    const storedValue: unknown =
      storedText === null ? [] : JSON.parse(storedText);

    return Array.isArray(storedValue)
      ? storedValue.filter(
          (storedVersion): storedVersion is string =>
            typeof storedVersion === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Records a version as announced. Returns false when it already was, so the
 * caller raises one notification per new version.
 */
export function markUpdateVersionAnnounced(offeredVersion: string): boolean {
  const announcedVersions = readAnnouncedUpdateVersions();
  if (announcedVersions.includes(offeredVersion)) {
    return false;
  }
  try {
    localStorage.setItem(
      announcedVersionsStorageKey,
      JSON.stringify(
        [offeredVersion, ...announcedVersions].slice(0, maxAnnouncedVersions),
      ),
    );
  } catch {
    // Storage may be full or blocked; the notification still shows once now.
  }

  return true;
}
