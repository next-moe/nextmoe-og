const MAX_PAYLOAD_CHARS = 8_000;

export interface DecodedPayload {
  fields: unknown;
  canonical: string;
}

export const decodePayload = (d: string): DecodedPayload | null => {
  if (!d || d.length > MAX_PAYLOAD_CHARS) return null;
  try {
    const json = Buffer.from(d, 'base64url').toString('utf8');
    return { fields: JSON.parse(json) as unknown, canonical: d };
  } catch {
    return null;
  }
};

/** The counterpart each site's buildOgUrl() needs; also what the POST route hashes on. */
export const encodePayload = (fields: unknown): string =>
  Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
