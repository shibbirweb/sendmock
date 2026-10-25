const loopbackHosts = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"];

/**
 * True when a URL points at the loopback address, which inside a Docker
 * container is the container itself, not the host (WH-01.4).
 */
export function isLoopbackUrl(urlText: string): boolean {
  try {
    return loopbackHosts.includes(new URL(urlText).hostname);
  } catch {
    return false;
  }
}

/** The same URL with the host swapped for `host.docker.internal`. */
export function toDockerHostUrl(urlText: string): string {
  const parsedUrl = new URL(urlText);
  parsedUrl.hostname = "host.docker.internal";

  return parsedUrl.toString();
}
