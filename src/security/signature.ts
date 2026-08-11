import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const equals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * The signed URL carries no site id (PLAN §3.1), so the signature is checked against every
 * configured key. Handful of sites, one HMAC each — cheaper than widening the URL contract.
 */
export const verify = (payload: string, signature: string): string | null => {
  for (const [site, secret] of config.siteKeys) {
    if (equals(sign(secret, payload), signature)) return site;
  }
  return null;
};

export const bearerSite = (token: string): string | null => {
  for (const [site, secret] of config.siteKeys) {
    if (equals(secret, token)) return site;
  }
  return null;
};
