import { encodePayload } from '../src/http/params';
import { sign } from '../src/security/signature';

const [template, secret, json] = process.argv.slice(2);

if (!template || !secret || !json) {
  console.error(
    'usage: tsx scripts/sign-url.ts <template> <site-secret> \'{"title":"…"}\' [base-url]',
  );
  process.exit(1);
}

const base = process.argv[5] ?? `http://127.0.0.1:${process.env.PORT ?? 3300}`;
const d = encodePayload(JSON.parse(json) as unknown);
console.log(`${base}/v1/og/${template}?d=${d}&sig=${sign(secret, d)}`);
