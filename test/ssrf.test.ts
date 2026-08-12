import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns', () => ({ promises: { lookup: vi.fn() } }));

import { promises as dns } from 'node:dns';
import { SsrfError, assertUrlAllowed, isPrivateIp } from '../src/security/ssrf';

const lookup = vi.mocked(dns.lookup);

beforeEach(() => {
  lookup.mockReset();
});

describe('isPrivateIp', () => {
  it('flags the non-routable ranges, including the ipv4-mapped disguise', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '::1',
      '::ffff:10.0.0.1',
      'garbage',
    ])
      expect(isPrivateIp(ip), ip).toBe(true);
  });

  it('flags the ipv6 tunnelling ranges that route back into the network', () => {
    for (const ip of [
      '2002:7f00:1::', // 6to4 wrapping 127.0.0.1
      '2001:0:0:0:0:0:0:1', // teredo
      '64:ff9b::a00:1', // NAT64 wrapping 10.0.0.1
      'fec0::1', // deprecated site-local
    ])
      expect(isPrivateIp(ip), ip).toBe(true);
  });

  it('passes public addresses', () => {
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('assertUrlAllowed', () => {
  it('rejects non-http(s) schemes and malformed urls', async () => {
    await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed('data:image/png;base64,AAAA')).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed('not a url')).rejects.toBeInstanceOf(SsrfError);
  });

  it('checks IP literals without touching DNS', async () => {
    await expect(assertUrlAllowed('https://1.1.1.1/cover.webp')).resolves.toBeInstanceOf(URL);
    await expect(
      assertUrlAllowed('http://169.254.169.254/latest/meta-data'),
    ).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed('http://[::1]/x')).rejects.toBeInstanceOf(SsrfError);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('resolves hostnames and rejects when ANY record is private', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(assertUrlAllowed('https://cdn.example.com/a.webp')).resolves.toBeInstanceOf(URL);

    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ] as never);
    await expect(assertUrlAllowed('https://cdn.example.com/a.webp')).rejects.toBeInstanceOf(
      SsrfError,
    );
  });

  it('rejects a hostname that does not resolve at all', async () => {
    lookup.mockResolvedValue([] as never);
    await expect(assertUrlAllowed('https://nowhere.example/a.webp')).rejects.toBeInstanceOf(
      SsrfError,
    );
    lookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertUrlAllowed('https://nowhere.example/a.webp')).rejects.toBeInstanceOf(
      SsrfError,
    );
  });
});
