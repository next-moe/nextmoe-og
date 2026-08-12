import { Hono } from 'hono';
import type { Context } from 'hono';
import { cacheKey } from '../cache/key';
import { singleFlight } from '../cache/single-flight';
import { cache } from '../cache/store';
import { config } from '../config';
import { decodePayload, encodePayload } from '../http/params';
import { log } from '../log';
import { bearerAuth } from '../middleware/auth';
import { QueueFullError, renderService } from '../render/renderer';
import { verify } from '../security/signature';
import { getTemplate } from '../templates';

export const ogRoutes = new Hono();

const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * A card drawn with a cover that failed to fetch must not be pinned for a year: the URL is
 * immutable by construction, so a 30-second CDN blip would otherwise freeze the lettermark
 * fallback forever. Degraded renders are also kept out of the cache.
 */
const DEGRADED = 'public, max-age=300';

const sendImage = (
  c: Context,
  body: Buffer,
  contentType: string,
  key: string,
  state: 'HIT' | 'MISS',
  cacheControl: string,
) =>
  c.body(new Uint8Array(body), 200, {
    'Content-Type': contentType,
    'Content-Length': String(body.byteLength),
    'Cache-Control': cacheControl,
    ETag: `"${key}"`,
    'X-Cache': state,
  });

const produce = async (c: Context, templateName: string, payload: string, fields: unknown) => {
  const template = getTemplate(templateName);
  if (!template) return c.json({ error: 'unknown_template' }, 404);

  const parsed = template.schema.safeParse(fields);
  if (!parsed.success) return c.json({ error: 'invalid_fields', detail: parsed.error.issues }, 400);

  const ext = config.RENDER_FORMAT;
  const key = cacheKey(templateName, payload, ext);
  const contentType = ext === 'webp' ? 'image/webp' : 'image/png';

  const hit = await cache.get(key, ext).catch(() => null);
  if (hit) return sendImage(c, hit, contentType, key, 'HIT', IMMUTABLE);

  try {
    const result = await singleFlight(key, async () => {
      const again = await cache.get(key, ext).catch(() => null);
      if (again) return { body: again, degraded: false };
      const drawn = await renderService.draw(template, parsed.data as never);
      if (!drawn.degraded)
        await cache
          .set(key, drawn.format, drawn.body)
          .catch((e: Error) => log.warn({ err: e.message, key }, 'cache write failed'));
      return { body: drawn.body, degraded: drawn.degraded };
    });
    const policy = result.degraded ? DEGRADED : IMMUTABLE;
    return sendImage(c, result.body, contentType, key, 'MISS', policy);
  } catch (e) {
    if (e instanceof QueueFullError) return c.json({ error: 'busy' }, 429, { 'Retry-After': '2' });
    log.error({ err: (e as Error).message, template: templateName }, 'render failed');
    return c.json({ error: 'render_failed' }, 500);
  }
};

ogRoutes.get('/:template', async (c) => {
  if (config.siteKeys.size === 0) return c.json({ error: 'service_unconfigured' }, 503);
  const template = c.req.param('template');
  const d = c.req.query('d') ?? '';
  const sig = c.req.query('sig') ?? '';
  const decoded = decodePayload(d);
  if (!decoded) return c.json({ error: 'invalid_params' }, 400);
  if (!sig || !verify(template, d, sig)) return c.json({ error: 'bad_signature' }, 403);
  return produce(c, template, decoded.canonical, decoded.fields);
});

/**
 * Prewarm and local preview. Send `{ "d": "<base64url>" }` to land on the exact cache key
 * the signed GET will ask for; a bare fields object re-encodes and may key differently.
 */
ogRoutes.post('/:template', bearerAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') return c.json({ error: 'invalid_params' }, 400);
  if (typeof body.d === 'string') {
    const decoded = decodePayload(body.d);
    if (!decoded) return c.json({ error: 'invalid_params' }, 400);
    return produce(c, c.req.param('template'), decoded.canonical, decoded.fields);
  }
  return produce(c, c.req.param('template'), encodePayload(body), body);
});
