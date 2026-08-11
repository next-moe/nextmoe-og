import { describe, expect, it } from 'vitest';
import { bearerSite, sign, verify } from '../src/security/signature';

const payload = 'eyJ0aXRsZSI6IuS4gCJ9';

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
    expect(verify(payload, sign('letmoe-secret', payload))).toBe('letmoe');
    expect(verify(payload, sign('patch-secret', payload))).toBe('patch');
  });

  it('rejects an unknown key, a tampered payload and a truncated signature', () => {
    expect(verify(payload, sign('outsider', payload))).toBeNull();
    expect(verify(`${payload}x`, sign('letmoe-secret', payload))).toBeNull();
    expect(verify(payload, sign('letmoe-secret', payload).slice(0, -1))).toBeNull();
    expect(verify(payload, '')).toBeNull();
  });
});

describe('bearerSite', () => {
  it('maps a raw secret to its site, and anything else to null', () => {
    expect(bearerSite('patch-secret')).toBe('patch');
    expect(bearerSite('patch-secre')).toBeNull();
    expect(bearerSite('')).toBeNull();
  });
});
