import type { RecordedHttpRequest } from "@/lib/api/types";

/** Wraps text in single quotes for a POSIX shell, escaping quotes inside. */
function quoteForShell(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

/** The recorded request as a cURL command to run again by hand (WH-03.8). */
export function buildCurlCommand(recordedRequest: RecordedHttpRequest): string {
  const commandParts = [
    `curl -X ${recordedRequest.method} ${quoteForShell(recordedRequest.url)}`,
  ];
  for (const [headerName, headerValue] of Object.entries(
    recordedRequest.headers,
  )) {
    commandParts.push(`-H ${quoteForShell(`${headerName}: ${headerValue}`)}`);
  }
  if (recordedRequest.body !== "") {
    commandParts.push(`--data-raw ${quoteForShell(recordedRequest.body)}`);
  }

  return commandParts.join(" \\\n  ");
}
