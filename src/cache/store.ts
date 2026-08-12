import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import Redis from 'ioredis';
import { config } from '../config';
import { log } from '../log';

const LRU_ZSET = 'og:lru';
const SIZE_HASH = 'og:size';
const TOTAL_KEY = 'og:total';

const KEY_RE = /^[0-9a-f]{64}$/;
const EXTS = new Set(['webp', 'png']);

interface SizeRecord {
  bytes: number;
  ext: string;
}

/** SIZE_HASH values are `<bytes>:<ext>` — the ext has to survive so eviction can find the file. */
const parseSize = (raw: string | null): SizeRecord | null => {
  if (!raw) return null;
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const bytes = Number(raw.slice(0, at));
  const ext = raw.slice(at + 1);
  return Number.isSafeInteger(bytes) && bytes >= 0 && EXTS.has(ext) ? { bytes, ext } : null;
};

const cacheRoot = (): string =>
  isAbsolute(config.CACHE_DIR) ? config.CACHE_DIR : join(process.cwd(), config.CACHE_DIR);

/**
 * Disk holds the bytes, Redis holds metadata and LRU accounting. Redis is optional:
 * with REDIS_URL unset the disk layer alone serves every hit, so a dev box needs no Redis.
 */
class CacheStore {
  private readonly redis: Redis | null = config.redisEnabled
    ? new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 })
    : null;

  constructor() {
    this.redis?.on('error', (e: Error) => log.warn({ err: e.message }, 'redis error'));
  }

  get redisEnabled(): boolean {
    return this.redis !== null;
  }

  /**
   * Eviction feeds keys back in from Redis, which lives on a shared network — an injected
   * key or ext would otherwise reach join() and delete files outside the cache tree.
   */
  private filePath = (key: string, ext: string): string | null =>
    KEY_RE.test(key) && EXTS.has(ext) ? join(cacheRoot(), key.slice(0, 2), `${key}.${ext}`) : null;

  get = async (key: string, ext: string): Promise<Buffer | null> => {
    const path = this.filePath(key, ext);
    if (!path) return null;
    const body = await readFile(path).catch(() => null);
    if (!body) return null;
    // A truncated or zero-byte file would otherwise be served as a valid card, forever:
    // the response is immutable and nothing ever re-renders that key.
    if (body.byteLength === 0) {
      await this.delete(key, ext).catch(() => {});
      return null;
    }
    const info = await stat(path).catch(() => null);
    if (info && Date.now() - info.mtimeMs > config.cacheTtlMs) {
      await this.delete(key, ext).catch(() => {});
      return null;
    }
    void this.touch(key);
    return body;
  };

  set = async (key: string, ext: string, body: Buffer): Promise<void> => {
    const path = this.filePath(key, ext);
    if (!path) throw new Error(`refusing to cache under key ${key}.${ext}`);
    if (body.byteLength === 0) throw new Error('refusing to cache an empty body');
    await mkdir(join(cacheRoot(), key.slice(0, 2)), { recursive: true });
    // Write then rename: a crash or a full disk mid-write must not leave a half file at the
    // final path, because every later request would serve it as a complete, immutable card.
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, body);
      await rename(temp, path);
    } catch (e) {
      await rm(temp, { force: true }).catch(() => {});
      throw e;
    }
    if (!this.redis) return;
    const previous = parseSize(await this.redis.hget(SIZE_HASH, key).catch(() => null));
    await this.redis
      .multi()
      .hset(SIZE_HASH, key, `${body.byteLength}:${ext}`)
      .zadd(LRU_ZSET, Date.now(), key)
      .incrby(TOTAL_KEY, body.byteLength - (previous?.bytes ?? 0))
      .exec();
  };

  /** Returns the bytes reclaimed, so eviction can track its own progress. */
  delete = async (key: string, extHint?: string): Promise<number> => {
    const record = await this.readSize(key);
    const ext = record?.ext ?? extHint;
    const path = ext ? this.filePath(key, ext) : null;
    if (path) await rm(path, { force: true }).catch(() => {});
    if (!this.redis) return 0;
    await this.redis
      .multi()
      .zrem(LRU_ZSET, key)
      .hdel(SIZE_HASH, key)
      .incrby(TOTAL_KEY, -(record?.bytes ?? 0))
      .exec();
    return record?.bytes ?? 0;
  };

  private readSize = async (key: string): Promise<SizeRecord | null> => {
    if (!this.redis) return null;
    return parseSize(await this.redis.hget(SIZE_HASH, key).catch(() => null));
  };

  private touch = async (key: string): Promise<void> => {
    if (!this.redis) return;
    await this.redis.zadd(LRU_ZSET, Date.now(), key).catch(() => {});
  };

  totalBytes = async (): Promise<number> => {
    if (!this.redis) return 0;
    const raw = await this.redis.get(TOTAL_KEY).catch(() => null);
    return Number(raw ?? 0);
  };

  evictToCap = async (): Promise<number> => {
    const redis = this.redis;
    if (!redis) return 0;
    let total = await this.totalBytes();
    let evicted = 0;
    while (total > config.cacheMaxBytes) {
      const batch = await redis.zrange(LRU_ZSET, 0, 49).catch(() => [] as string[]);
      if (batch.length === 0) break;
      for (const key of batch) {
        total -= await this.delete(key);
        evicted += 1;
        if (total <= config.cacheMaxBytes) break;
      }
    }
    return evicted;
  };

  ping = async (): Promise<'ok' | 'down' | 'disabled'> => {
    if (!this.redis) return 'disabled';
    const pong = await this.redis.ping().catch(() => null);
    return pong === 'PONG' ? 'ok' : 'down';
  };

  close = async (): Promise<void> => {
    await this.redis?.quit().catch(() => {});
  };
}

export const cache = new CacheStore();
