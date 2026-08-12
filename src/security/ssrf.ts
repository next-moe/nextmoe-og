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
  // Allowlist, not blocklist: 'unicast' is ipaddr.js's label for publicly routable, and every
  // other label (6to4, teredo, rfc6052, deprecated site-local…) is a way back into the network.
  return addr.range() !== 'unicast';
};

/**
 * dns.lookup carries no timeout of its own and runs on the libuv threadpool, so a stalling
 * resolver would hold a render slot for the OS resolver's full retry budget.
 */
const lookupWithTimeout = async (hostname: string): Promise<{ address: string }[]> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      dns.lookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new SsrfError('dns lookup timed out')),
          config.DNS_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    throw e instanceof SsrfError ? e : new SsrfError('dns lookup failed');
  } finally {
    clearTimeout(timer);
  }
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

  const records = await lookupWithTimeout(hostname);
  if (records.length === 0) throw new SsrfError('dns returned no records');
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new SsrfError('private address');
  }
  return url;
};
