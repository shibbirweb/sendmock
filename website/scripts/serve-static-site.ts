import { createReadStream, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { extname, join } from "node:path";

import {
  resolveStaticSiteRequest,
  type StaticSitePathKind,
} from "../lib/static-site-request";

// Serves a static export as GitHub Pages does, for the versioned site tests: `serve` lists a
// folder named like a file (`v1.0/`) instead of serving its index.html.
// Usage: bun scripts/serve-static-site.ts <site directory> <port> [404 page path]
const [siteDirectory, portArgument, notFoundPagePath = "404.html"] =
  process.argv.slice(2);
if (siteDirectory === undefined || portArgument === undefined) {
  console.error(
    "Usage: bun scripts/serve-static-site.ts <site directory> <port> [404 page path]",
  );
  process.exit(1);
}

const contentTypesByExtension: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
};

function findPathKind(relativePath: string): StaticSitePathKind {
  try {
    const pathStats = statSync(join(siteDirectory, relativePath));
    if (pathStats.isDirectory()) {
      return "directory";
    }
    return pathStats.isFile() ? "file" : "missing";
  } catch {
    return "missing";
  }
}

function sendSiteFile(
  response: ServerResponse,
  relativeFilePath: string,
  statusCode: number,
): void {
  response.writeHead(statusCode, {
    "Content-Type":
      contentTypesByExtension[extname(relativeFilePath)] ??
      "application/octet-stream",
  });
  createReadStream(join(siteDirectory, relativeFilePath)).pipe(response);
}

const staticSiteServer = createServer((request, response) => {
  const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const staticSiteResponse = resolveStaticSiteRequest(
    requestPath,
    findPathKind,
  );
  if (staticSiteResponse.kind === "file") {
    sendSiteFile(response, staticSiteResponse.relativeFilePath, 200);
    return;
  }
  if (staticSiteResponse.kind === "redirect") {
    response.writeHead(301, { Location: staticSiteResponse.location });
    response.end();
    return;
  }
  if (findPathKind(notFoundPagePath) === "file") {
    sendSiteFile(response, notFoundPagePath, 404);
    return;
  }
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

staticSiteServer.listen(Number(portArgument), "127.0.0.1", () => {
  console.log(`Serving ${siteDirectory} at http://127.0.0.1:${portArgument}`);
});
