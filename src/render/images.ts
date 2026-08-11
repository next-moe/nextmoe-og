import { config } from '../config';
import { log } from '../log';

export interface LoadedImage {
  src: string;
  data: ArrayBuffer;
}

const isHttp = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const readLimited = async (res: Response): Promise<ArrayBuffer> => {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > config.IMAGE_MAX_BYTES) throw new Error(`content-length ${declared} too large`);
  const body = await res.arrayBuffer();
  if (body.byteLength > config.IMAGE_MAX_BYTES)
    throw new Error(`body ${body.byteLength} too large`);
  return body;
};

const fetchOne = async (src: string): Promise<LoadedImage | null> => {
  if (!isHttp(src)) return null;
  const signal = AbortSignal.timeout(config.IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(src, { signal, redirect: 'follow' });
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
