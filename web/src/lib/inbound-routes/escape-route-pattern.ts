/** A route pattern that takes exactly this address, its dots and pluses escaped. */
export function buildExactAddressPattern(address: string): string {
  const escapedAddress = address.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return `^${escapedAddress}$`;
}
