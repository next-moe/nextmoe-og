import { config } from '../config';
import { log } from '../log';
import { assertUrlAllowed } from '../security/ssrf';

export interface LoadedImage {
  src: string;
  data: ArrayBuffer;
}

const MAX_REDIRECTS = 3;

const readLimited = async (res: Response): Promise<ArrayBuffer> => {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > config.IMAGE_MAX_BYTES) throw new Error(`content-length ${declared} too large`);
  const body = await res.arrayBuffer();
  if (body.byteLength > config.IMAGE_MAX_BYTES)
    throw new Error(`body ${body.byteLength} too large`);
  return body;
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
