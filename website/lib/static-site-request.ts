export type StaticSitePathKind = "file" | "directory" | "missing";

export type StaticSiteResponse =
  | { kind: "file"; relativeFilePath: string }
  | { kind: "redirect"; location: string }
  | { kind: "not-found" };

/**
 * Maps a request path to a file of a static export the way GitHub Pages does: a folder serves
 * its index.html whatever its name (a version folder such as v1.0 included), `/page` falls back
 * to page.html, and a folder asked for without its slash redirects to it.
 */
export function resolveStaticSiteRequest(
  requestPath: string,
  findPathKind: (relativePath: string) => StaticSitePathKind,
): StaticSiteResponse {
  const decodedPath = decodeRequestPath(requestPath);
  if (decodedPath === null) {
    return { kind: "not-found" };
  }
  const pathSegments = decodedPath
    .split("/")
    .filter((segment) => segment !== "");
  if (pathSegments.some((segment) => segment === "." || segment === "..")) {
    return { kind: "not-found" };
  }
  const relativePath = pathSegments.join("/");

  if (decodedPath.endsWith("/")) {
    const indexFilePath = joinRelativePath(relativePath, "index.html");
    if (findPathKind(indexFilePath) === "file") {
      return { kind: "file", relativeFilePath: indexFilePath };
    }
    return { kind: "not-found" };
  }

  const requestedPathKind = findPathKind(relativePath);
  if (requestedPathKind === "file") {
    return { kind: "file", relativeFilePath: relativePath };
  }
  if (findPathKind(`${relativePath}.html`) === "file") {
    return { kind: "file", relativeFilePath: `${relativePath}.html` };
  }
  if (requestedPathKind === "directory") {
    return { kind: "redirect", location: `${decodedPath}/` };
  }
  return { kind: "not-found" };
}

function decodeRequestPath(requestPath: string): string | null {
  try {
    return decodeURIComponent(requestPath);
  } catch {
    return null;
  }
}

function joinRelativePath(directoryPath: string, fileName: string): string {
  if (directoryPath === "") {
    return fileName;
  }
  return `${directoryPath}/${fileName}`;
}
