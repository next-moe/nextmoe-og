import { describe, expect, it } from 'vitest';
import { parseSiteKeys } from '../src/config';

describe('parseSiteKeys', () => {
  it('reads site:secret pairs and tolerates whitespace and a trailing comma', () => {
    expect([...parseSiteKeys(' patch:a , letmoe:b ,')]).toEqual([
      ['patch', 'a'],
      ['letmoe', 'b'],
    ]);
    expect(parseSiteKeys('').size).toBe(0);
  });

  it('keeps a secret containing a colon intact', () => {
    expect(parseSiteKeys('infra:a:b:c').get('infra')).toBe('a:b:c');
  });

  it('aborts instead of silently dropping an entry the operator got wrong', () => {
    expect(() => parseSiteKeys('patch:a,letmoe')).toThrow(/OG_SITE_KEYS/);
    expect(() => parseSiteKeys('patch:a,:b')).toThrow(/OG_SITE_KEYS/);
    expect(() => parseSiteKeys('patch:a,forum:')).toThrow(/OG_SITE_KEYS/);
    expect(() => parseSiteKeys('patch:a,patch:b')).toThrow(/duplicate/);
  });
});
