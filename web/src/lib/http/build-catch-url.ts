/**
 * Where an app sends requests for a bin. A server bound to every interface
 * (`0.0.0.0`, as in Docker) is reached on 127.0.0.1 from this machine.
 */
export function buildCatchUrl(httpAddress: string, binName: string): string {
  const reachableAddress = httpAddress.replace(/^0\.0\.0\.0(?=:)/, "127.0.0.1");

  return `http://${reachableAddress}/catch/${binName}`;
}
