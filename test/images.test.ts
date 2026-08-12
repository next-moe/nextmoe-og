import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/security/ssrf', () => ({
  assertUrlAllowed: vi.fn(async (raw: string) => new URL(raw)),
}));

import { config } from '../src/config';
import { loadImages } from '../src/render/images';

const streamOf = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

/** A chunked response: no content-length, so only the streaming cap can stop it. */
const chunked = (chunks: Uint8Array[], headers: Record<string, string> = {}): Response =>
  new Response(streamOf(chunks), { status: 200, headers });

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadImages', () => {
  it('returns the exact bytes of a small response', async () => {
    mockFetch.mockResolvedValue(chunked([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]));
    const loaded = await loadImages(['https://cdn.example.com/a.webp']);
    expect(new Uint8Array(loaded[0]!.data)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('rejects an oversized body that never declares content-length', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const chunks = Array.from({ length: Math.ceil(config.IMAGE_MAX_BYTES / chunk.byteLength) + 2 })
      .fill(chunk)
      .map(() => chunk);
    mockFetch.mockResolvedValue(chunked(chunks));
    expect(await loadImages(['https://cdn.example.com/huge.webp'])).toEqual([]);
  });

  it('rejects on a declared content-length over the cap without reading the body', async () => {
    mockFetch.mockResolvedValue(
      chunked([new Uint8Array([1])], {
        'content-length': String(config.IMAGE_MAX_BYTES + 1),
      }),
    );
    expect(await loadImages(['https://cdn.example.com/lying.webp'])).toEqual([]);
  });

  it('degrades to nothing rather than throwing when the fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await loadImages(['https://cdn.example.com/dead.webp'])).toEqual([]);
  });

  it('fetches each unique url once', async () => {
    mockFetch.mockResolvedValue(chunked([new Uint8Array([7])]));
    const url = 'https://cdn.example.com/same.webp';
    expect(await loadImages([url, url])).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
