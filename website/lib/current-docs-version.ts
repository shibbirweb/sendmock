import { basePath } from "@/lib/base-path";
import { type DocsVersionKind, resolveDocsVersions } from "@/lib/docs-versions";

/** One entry of the version switcher, as scripts/build-docs-versions.ts writes it. */
export type DocsVersionLink = {
  key: string;
  label: string;
  kind: DocsVersionKind;
  /** The version's site root, e.g. "/sendmock/next/". */
  href: string;
};

/** A plain build (local, pull requests) is the Preview, next to the beta docs. */
function listDefaultVersionLinks(siteBasePath: string): DocsVersionLink[] {
  return resolveDocsVersions([]).map((docsVersion) => ({
    key: docsVersion.key,
    label: docsVersion.label,
    kind: docsVersion.kind,
    href: `${siteBasePath}${docsVersion.path}/`,
  }));
}

/** The switcher's list from NEXT_PUBLIC_DOCS_VERSIONS; a missing or broken list falls back. */
export function parseDocsVersionLinks(
  versionsJson: string | undefined,
  siteBasePath: string,
): DocsVersionLink[] {
  if (versionsJson === undefined || versionsJson === "") {
    return listDefaultVersionLinks(siteBasePath);
  }

  try {
    const versionLinks: unknown = JSON.parse(versionsJson);

    return Array.isArray(versionLinks) && versionLinks.length > 0
      ? (versionLinks as DocsVersionLink[])
      : listDefaultVersionLinks(siteBasePath);
  } catch {
    return listDefaultVersionLinks(siteBasePath);
  }
}

export const docsVersionLinks = parseDocsVersionLinks(
  process.env.NEXT_PUBLIC_DOCS_VERSIONS,
  basePath,
);

const currentVersionKey = process.env.NEXT_PUBLIC_DOCS_VERSION ?? "preview";

/** The version this build is (WS-03.6). */
export const currentDocsVersion =
  docsVersionLinks.find(
    (versionLink) => versionLink.key === currentVersionKey,
  ) ?? docsVersionLinks[0];

/** The latest stable version, once the first stable tag exists. */
export const stableDocsVersion = docsVersionLinks.find(
  (versionLink) => versionLink.kind === "stable",
);
