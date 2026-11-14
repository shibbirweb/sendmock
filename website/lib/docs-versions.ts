/**
 * The docs versions the site is built as (docs/plan/16-website-and-releases.md,
 * "Versioned builds", WS-03.4). Worked out from the git tags, never typed.
 */

export type DocsVersionKind = "stable" | "next" | "older" | "preview";

export type DocsVersion = {
  /** "stable", "next", "preview" or "v0.2"; the build's NEXT_PUBLIC_DOCS_VERSION. */
  key: string;
  label: string;
  /** Where the version lives under the site root: "" for /, "/next", "/v0.2". */
  path: string;
  kind: DocsVersionKind;
  /** The tag it is built from; null builds the working tree (develop). */
  gitRef: string | null;
};

type StableTag = {
  tagName: string;
  major: number;
  minor: number;
  patch: number;
};

const stableTagPattern = /^v(\d+)\.(\d+)\.(\d+)$/;

const nextVersion: DocsVersion = {
  key: "next",
  label: "Beta (next)",
  path: "/next",
  kind: "next",
  gitRef: null,
};

function parseStableTag(tagName: string): StableTag | null {
  const tagMatch = stableTagPattern.exec(tagName.trim());
  if (tagMatch === null) {
    return null;
  }

  return {
    tagName: tagName.trim(),
    major: Number(tagMatch[1]),
    minor: Number(tagMatch[2]),
    patch: Number(tagMatch[3]),
  };
}

function compareNewestFirst(firstTag: StableTag, secondTag: StableTag) {
  return (
    secondTag.major - firstTag.major ||
    secondTag.minor - firstTag.minor ||
    secondTag.patch - firstTag.patch
  );
}

/** The newest patch of each minor, newest minor first. */
function listNewestTagPerMinor(tagNames: string[]): StableTag[] {
  const stableTags = tagNames
    .map(parseStableTag)
    .filter((stableTag): stableTag is StableTag => stableTag !== null)
    .sort(compareNewestFirst);
  const seenMinors = new Set<string>();

  return stableTags.filter((stableTag) => {
    const minorKey = `${stableTag.major}.${stableTag.minor}`;
    if (seenMinors.has(minorKey)) {
      return false;
    }
    seenMinors.add(minorKey);

    return true;
  });
}

/**
 * `/` is the newest stable minor, `/next/` is develop, `/vX.Y/` the older
 * minors. Beta tags get no docs of their own; before the first stable tag,
 * `/` is a Preview built from develop.
 */
export function resolveDocsVersions(tagNames: string[]): DocsVersion[] {
  const [newestTag, ...olderTags] = listNewestTagPerMinor(tagNames);
  if (newestTag === undefined) {
    return [
      {
        key: "preview",
        label: "Preview",
        path: "",
        kind: "preview",
        gitRef: null,
      },
      nextVersion,
    ];
  }

  return [
    {
      key: "stable",
      label: `Stable ${newestTag.tagName}`,
      path: "",
      kind: "stable",
      gitRef: newestTag.tagName,
    },
    nextVersion,
    ...olderTags.map((olderTag) => ({
      key: `v${olderTag.major}.${olderTag.minor}`,
      label: olderTag.tagName,
      path: `/v${olderTag.major}.${olderTag.minor}`,
      kind: "older" as const,
      gitRef: olderTag.tagName,
    })),
  ];
}
