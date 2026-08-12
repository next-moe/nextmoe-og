import { config } from '../config';
import { log } from '../log';
import { assertUrlAllowed } from '../security/ssrf';

export interface LoadedImage {
  src: string;
  data: ArrayBuffer;
}

const MAX_REDIRECTS = 3;

/**
 * content-length is the sender's claim and a chunked response omits it entirely, so the cap
 * is enforced while reading — arrayBuffer() would already have the whole body in memory by
 * the time it could be checked, and only the fetch timeout would bound it.
 */
const readLimited = async (res: Response): Promise<ArrayBuffer> => {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > config.IMAGE_MAX_BYTES) throw new Error(`content-length ${declared} too large`);
  if (!res.body) throw new Error('response had no body');

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > config.IMAGE_MAX_BYTES) throw new Error(`body over ${config.IMAGE_MAX_BYTES}`);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out.buffer;
};

/** Redirects are followed by hand so every hop goes through the SSRF check, not just the first. */
const fetchVetted = async (src: string, signal: AbortSignal): Promise<Response> => {
  let target = src;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertUrlAllowed(target);
    const res = await fetch(url, { signal, redirect: 'manual' });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) throw new Error(`HTTP ${res.status} without location`);
    target = new URL(location, url).toString();
  }
  throw new Error('too many redirects');
};

const fetchOne = async (src: string): Promise<LoadedImage | null> => {
  const signal = AbortSignal.timeout(config.IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetchVetted(src, signal);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { src, data: await readLimited(res) };
  } catch (e) {
    log.warn({ src, err: (e as Error).message }, 'image fetch failed, degrading');
    return null;
  }
};

/**
 * takumi's render() fetches remote images itself, but it hardcodes prepareImages'
 * throwOnError: true — one dead cover URL kills the whole render. So we pre-fetch under
 * our own timeout and hand the bytes over; a failed URL just never reaches the renderer.
 */
export const loadImages = async (urls: string[]): Promise<LoadedImage[]> => {
  const unique = [...new Set(urls)];
  const results = await Promise.all(unique.map(fetchOne));
  return results.filter((r): r is LoadedImage => r !== null);
};
