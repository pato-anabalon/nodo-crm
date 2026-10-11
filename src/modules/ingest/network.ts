import { BlockList, isIP } from "node:net";

/**
 * Addresses a form's attachment link must never lead us to.
 *
 * The links come from outside, so without this check anyone with a key could
 * make the server fetch its own metadata endpoint or something on the private
 * network and keep the answer as an "attachment".
 */
const blocked = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast and reserved above it
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  if (version === 4) return !blocked.check(address, "ipv4");

  // An IPv4 address written as IPv6 (`::ffff:10.0.0.1`) is judged as IPv4.
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]!);
  return !blocked.check(address, "ipv6");
}
