import { describe, expect, it } from 'vitest';
import { cacheKey } from '../src/cache/key';
import { decodePayload, encodePayload } from '../src/http/params';

describe('decodePayload', () => {
  it('round-trips through encodePayload and keeps `d` verbatim as the canonical form', () => {
    const fields = { title: '素晴らしき日々', badges: ['ADV'] };
    const d = encodePayload(fields);
    const decoded = decodePayload(d);
    expect(decoded?.fields).toEqual(fields);
    expect(decoded?.canonical).toBe(d);
  });

  it('rejects empty, oversized and non-JSON payloads', () => {
    expect(decodePayload('')).toBeNull();
    expect(decodePayload(encodePayload({ t: 'x'.repeat(9_000) }))).toBeNull();
    expect(decodePayload(Buffer.from('not json', 'utf8').toString('base64url'))).toBeNull();
  });
});

describe('cacheKey', () => {
  it('is stable for the same inputs and distinct across template, payload and format', () => {
    const d = encodePayload({ title: 'a' });
    expect(cacheKey('work', d, 'webp')).toBe(cacheKey('work', d, 'webp'));
    expect(cacheKey('work', d, 'webp')).not.toBe(cacheKey('patch', d, 'webp'));
    expect(cacheKey('work', d, 'webp')).not.toBe(
      cacheKey('work', encodePayload({ title: 'b' }), 'webp'),
    );
    expect(cacheKey('work', d, 'webp')).not.toBe(cacheKey('work', d, 'png'));
  });

  it('keys on the payload string, so field order changes the key (URLs are immutable by construction)', () => {
    const a = cacheKey('work', encodePayload({ a: 1, b: 2 }), 'webp');
    const b = cacheKey('work', encodePayload({ b: 2, a: 1 }), 'webp');
    expect(a).not.toBe(b);
  });
});
