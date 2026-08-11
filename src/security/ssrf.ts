import { promises as dns } from 'node:dns';
import ipaddr from 'ipaddr.js';
import { config } from '../config';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** ipaddr.js range labels that are not publicly routable. */
const BLOCKED_RANGES = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'private',
  'uniqueLocal',
  'carrierGradeNat',
  'reserved',
]);

export const isPrivateIp = (ip: string): boolean => {
  let addr: ReturnType<typeof ipaddr.parse>;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return true;
  }
  // ::ffff:127.0.0.1 parses as ipv6; unwrap it or a mapped private address walks straight through.
  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) return isPrivateIp(v6.toIPv4Address().toString());
  }
  return BLOCKED_RANGES.has(addr.range());
};

/**
 * Vet a caller-supplied cover URL before fetching it. http(s) only, and no hostname
 * that resolves to a private / loopback / link-local / reserved address.
 *
 * A pre-check cannot pin the IP the socket ends up on, so a DNS-rebinding window
 * remains; the payoff of closing it (an egress proxy, as in kun-website-screenshot)
 * does not match the blast radius here — the response never reaches the caller, it
 * only gets drawn into a card.
 */
export const assertUrlAllowed = async (rawUrl: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError('invalid url');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new SsrfError(`protocol ${url.protocol}`);

  if (config.ALLOW_PRIVATE_HOSTS) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (ipaddr.isValid(hostname)) {
    if (isPrivateIp(hostname)) throw new SsrfError('private address');
    return url;
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfError('dns lookup failed');
  }
  if (records.length === 0) throw new SsrfError('dns returned no records');
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new SsrfError('private address');
  }
  return url;
};
