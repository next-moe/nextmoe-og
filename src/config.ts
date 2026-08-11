import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3300),

  OG_SITE_KEYS: z.string().default(''),
  OG_BRAND: z.string().default('NextMoe·未萌'),

  FONT_DIR: z.string().default('assets/fonts'),

  CACHE_DIR: z.string().default('cache'),
  CACHE_TTL_DAYS: z.coerce.number().positive().default(30),
  CACHE_MAX_MB: z.coerce.number().positive().default(2048),
  REDIS_URL: z.string().default(''),

  RENDER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  RENDER_QUEUE_MAX: z.coerce.number().int().nonnegative().default(32),
  RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RENDER_FORMAT: z.enum(['webp', 'png']).default('webp'),
  RENDER_QUALITY: z.coerce.number().int().min(1).max(100).default(88),

  IMAGE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
  IMAGE_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),
  ALLOW_PRIVATE_HOSTS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = EnvSchema.parse(process.env);

const parseSiteKeys = (raw: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const at = trimmed.indexOf(':');
    if (at <= 0) continue;
    const site = trimmed.slice(0, at).trim();
    const secret = trimmed.slice(at + 1).trim();
    if (site && secret) out.set(site, secret);
  }
  return out;
};

export const config = {
  ...parsed,
  siteKeys: parseSiteKeys(parsed.OG_SITE_KEYS),
  cacheTtlMs: parsed.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  cacheMaxBytes: parsed.CACHE_MAX_MB * 1024 * 1024,
  redisEnabled: parsed.REDIS_URL.trim().length > 0,
};

export type Config = typeof config;
