import { describe, expect, it } from 'vitest';
import { bearerSite, sign, signedMessage, verify } from '../src/security/signature';

const payload = 'eyJ0aXRsZSI6IuS4gCJ9';
const signFor = (secret: string, template: string, d = payload): string =>
  sign(secret, signedMessage(template, d));

describe('sign', () => {
  it('is deterministic and base64url (no +/= in the alphabet)', () => {
    const a = sign('letmoe-secret', payload);
    expect(a).toBe(sign('letmoe-secret', payload));
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('differs per secret and per payload', () => {
    expect(sign('letmoe-secret', payload)).not.toBe(sign('patch-secret', payload));
    expect(sign('letmoe-secret', payload)).not.toBe(sign('letmoe-secret', `${payload}x`));
  });
});

describe('verify', () => {
  it('names the site whose key signed it', () => {
    expect(verify('work', payload, signFor('letmoe-secret', 'work'))).toBe('letmoe');
    expect(verify('work', payload, signFor('patch-secret', 'work'))).toBe('patch');
  });

  it('rejects an unknown key, a tampered payload and a truncated signature', () => {
    expect(verify('work', payload, signFor('outsider', 'work'))).toBeNull();
    expect(verify('work', `${payload}x`, signFor('letmoe-secret', 'work'))).toBeNull();
    expect(verify('work', payload, signFor('letmoe-secret', 'work').slice(0, -1))).toBeNull();
    expect(verify('work', payload, '')).toBeNull();
  });

  it('does not let a card URL be replayed against another template', () => {
    const sig = signFor('letmoe-secret', 'work');
    for (const other of ['patch', 'topic', 'person', 'character', 'label', 'site'])
      expect(verify(other, payload, sig), other).toBeNull();
  });

  it('cannot be confused by a template name that eats part of the payload', () => {
    // `\n` never occurs in base64url, so no (template, payload) pair can produce another's message.
    expect(signedMessage('work', payload)).not.toBe(signedMessage(`work\n${payload}`, ''));
    expect(verify('work', payload, signFor('letmoe-secret', 'wor', `k\n${payload}`))).toBeNull();
  });
});

describe('bearerSite', () => {
  it('maps a raw secret to its site, and anything else to null', () => {
    expect(bearerSite('patch-secret')).toBe('patch');
    expect(bearerSite('patch-secre')).toBeNull();
    expect(bearerSite('')).toBeNull();
  });
});
