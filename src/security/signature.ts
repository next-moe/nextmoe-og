import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export const sign = (secret: string, message: string): string =>
  createHmac('sha256', secret).update(message).digest('base64url');

/**
 * What actually gets signed. The template lives in the URL path, so signing `d` alone let a
 * captured card URL be replayed against every other template — zod strips unknown keys, so
 * overlapping payloads rendered happily. `\n` cannot occur in base64url, so the join is
 * unambiguous. Changing this format invalidates every URL already in the wild.
 */
export const signedMessage = (template: string, payload: string): string =>
  `${template}\n${payload}`;

const equals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * The signed URL carries no site id (PLAN §3.1), so the signature is checked against every
 * configured key. Handful of sites, one HMAC each — cheaper than widening the URL contract.
 */
export const verify = (template: string, payload: string, signature: string): string | null => {
  const message = signedMessage(template, payload);
  for (const [site, secret] of config.siteKeys) {
    if (equals(sign(secret, message), signature)) return site;
  }
  return null;
};

export const bearerSite = (token: string): string | null => {
  for (const [site, secret] of config.siteKeys) {
    if (equals(secret, token)) return site;
  }
  return null;
};
