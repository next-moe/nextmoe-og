import { mkdtempSync } from 'node:fs';
import { readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'og-cache-'));
process.env.CACHE_DIR = root;

const { cache } = await import('../src/cache/store');
const { config } = await import('../src/config');

const key = 'a'.repeat(64);
const body = Buffer.from('not really a webp, but non-empty');
const filePath = join(root, key.slice(0, 2), `${key}.webp`);

afterAll(async () => {
  await cache.close();
});

describe('set', () => {
  beforeAll(async () => {
    await cache.set(key, 'webp', body);
  });

  it('round-trips the bytes', async () => {
    expect(await cache.get(key, 'webp')).toEqual(body);
  });

  it('leaves no temp file behind', async () => {
    const files = await readdir(join(root, key.slice(0, 2)));
    expect(files).toEqual([`${key}.webp`]);
  });

  it('refuses an empty body rather than caching a 0-byte card forever', async () => {
    await expect(cache.set('b'.repeat(64), 'webp', Buffer.alloc(0))).rejects.toThrow();
  });

  it('refuses a key or ext that is not the shape cacheKey() produces', async () => {
    await expect(cache.set('../../etc/passwd', 'webp', body)).rejects.toThrow();
    await expect(cache.set(key, 'webp/../../x', body)).rejects.toThrow();
  });
});

describe('get', () => {
  it('is null for an unknown key and for a mismatched ext', async () => {
    expect(await cache.get('c'.repeat(64), 'webp')).toBeNull();
    expect(await cache.get(key, 'png')).toBeNull();
  });

  it('is null (and never reaches the filesystem) for an injected key', async () => {
    expect(await cache.get('../../../etc/hosts', 'webp')).toBeNull();
  });

  it('discards a truncated write instead of serving it', async () => {
    const empty = 'd'.repeat(64);
    const path = join(root, empty.slice(0, 2), `${empty}.webp`);
    await cache.set(empty, 'webp', body);
    await writeFile(path, Buffer.alloc(0));
    expect(await cache.get(empty, 'webp')).toBeNull();
    await expect(readFile(path)).rejects.toThrow();
  });

  it('discards an entry past CACHE_TTL_DAYS', async () => {
    const stale = new Date(Date.now() - config.cacheTtlMs - 60_000);
    await utimes(filePath, stale, stale);
    expect(await cache.get(key, 'webp')).toBeNull();
  });
});
