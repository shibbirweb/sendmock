/**
 * Where an app sends requests for a bin. A server bound to every interface
 * (`0.0.0.0`, as in Docker) is reached on 127.0.0.1 from this machine.
 */
export function buildCatchUrl(httpAddress: string, binName: string): string {
  return `http://${toReachableAddress(httpAddress)}/catch/${binName}`;
}

/**
 * A bin's URL on the catch-all port (`--catcher-addr`), where the first path segment
 * names the bin; null when the port is off.
 */
export function buildCatchPortUrl(
  catcherAddress: string | null,
  binName: string,
): string | null {
  if (catcherAddress === null) {
    return null;
  }

  return `http://${toReachableAddress(catcherAddress)}/${binName}`;
}

function toReachableAddress(listenAddress: string): string {
  return listenAddress.replace(/^0\.0\.0\.0(?=:)/, "127.0.0.1");
}
