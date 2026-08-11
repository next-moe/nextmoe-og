import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import Redis from 'ioredis';
import { config } from '../config';
import { log } from '../log';

const META_PREFIX = 'og:meta:';
const LRU_ZSET = 'og:lru';
const SIZE_HASH = 'og:size';
const TOTAL_KEY = 'og:total';

export interface CacheEntry {
  body: Buffer;
  contentType: string;
}

interface Meta {
  ext: string;
  contentType: string;
  bytes: number;
  createdAt: number;
}

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

  private filePath = (key: string, ext: string): string =>
    join(cacheRoot(), key.slice(0, 2), `${key}.${ext}`);

  get = async (key: string, ext: string, contentType: string): Promise<CacheEntry | null> => {
    const path = this.filePath(key, ext);
    const body = await readFile(path).catch(() => null);
    if (!body) return null;
    const info = await stat(path).catch(() => null);
    if (info && Date.now() - info.mtimeMs > config.cacheTtlMs) {
      await this.delete(key, ext).catch(() => {});
      return null;
    }
    const meta = await this.readMeta(key);
    void this.touch(key);
    return { body, contentType: meta?.contentType ?? contentType };
  };

  set = async (key: string, ext: string, contentType: string, body: Buffer): Promise<void> => {
    await mkdir(join(cacheRoot(), key.slice(0, 2)), { recursive: true });
    await writeFile(this.filePath(key, ext), body);
    if (!this.redis) return;
    const meta: Meta = { ext, contentType, bytes: body.byteLength, createdAt: Date.now() };
    const ttlSeconds = Math.ceil(config.cacheTtlMs / 1000);
    await this.redis.set(`${META_PREFIX}${key}`, JSON.stringify(meta), 'EX', ttlSeconds);
    await this.redis.zadd(LRU_ZSET, Date.now(), key);
    await this.redis.hset(SIZE_HASH, key, body.byteLength);
    await this.redis.incrby(TOTAL_KEY, body.byteLength);
  };

  delete = async (key: string, extHint?: string): Promise<void> => {
    const meta = await this.readMeta(key);
    const ext = meta?.ext ?? extHint;
    if (ext) await rm(this.filePath(key, ext), { force: true }).catch(() => {});
    if (!this.redis) return;
    await this.redis.del(`${META_PREFIX}${key}`).catch(() => {});
    await this.redis.zrem(LRU_ZSET, key).catch(() => {});
    await this.redis.hdel(SIZE_HASH, key).catch(() => {});
    if (meta) await this.redis.incrby(TOTAL_KEY, -meta.bytes).catch(() => {});
  };

  private readMeta = async (key: string): Promise<Meta | null> => {
    if (!this.redis) return null;
    const raw = await this.redis.get(`${META_PREFIX}${key}`).catch(() => null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Meta;
    } catch {
      return null;
    }
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
        const bytes = Number((await redis.hget(SIZE_HASH, key).catch(() => null)) ?? 0);
        await this.delete(key);
        total -= bytes;
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
