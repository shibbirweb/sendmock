import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const initialJsBudgetBytes = 250 * 1024;
export const distBudgetBytes = 2 * 1024 * 1024;

export type BundleMeasurement = {
  initialScriptPaths: string[];
  initialJsGzipBytes: number;
  distBytes: number;
};

/** The entry script and every module it preloads, as paths inside `dist`. */
export function listInitialScriptPaths(indexHtml: string): string[] {
  const entryScripts = Array.from(
    indexHtml.matchAll(/<script[^>]*\ssrc="\/([^"]+\.js)"/g),
    (scriptMatch) => scriptMatch[1] ?? "",
  );
  const preloadedModules = Array.from(
    indexHtml.matchAll(
      /<link[^>]*rel="modulepreload"[^>]*href="\/([^"]+\.js)"/g,
    ),
    (preloadMatch) => preloadMatch[1] ?? "",
  );

  return [...entryScripts, ...preloadedModules];
}

function listFilePaths(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = join(directoryPath, entryName);

    return statSync(entryPath).isDirectory()
      ? listFilePaths(entryPath)
      : [entryPath];
  });
}

/** Gzipped initial JS and the total size of `dist` without source maps. */
export function measureBundle(distDirectory: string): BundleMeasurement {
  const indexHtml = readFileSync(join(distDirectory, "index.html"), "utf8");
  const initialScriptPaths = listInitialScriptPaths(indexHtml);
  const initialJsGzipBytes = initialScriptPaths
    .map((scriptPath) => readFileSync(join(distDirectory, scriptPath)))
    .reduce(
      (totalBytes, scriptContent) =>
        totalBytes + Bun.gzipSync(scriptContent).byteLength,
      0,
    );
  const distBytes = listFilePaths(distDirectory)
    .filter((filePath) => !filePath.endsWith(".map"))
    .reduce((totalBytes, filePath) => totalBytes + statSync(filePath).size, 0);

  return { initialScriptPaths, initialJsGzipBytes, distBytes };
}
