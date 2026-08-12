import { Hono } from 'hono';
import { inflightCount } from '../cache/single-flight';
import { cache } from '../cache/store';
import { config } from '../config';
import { renderService } from '../render/renderer';
import { templateNames } from '../templates';

export const healthRoutes = new Hono();

/**
 * Redis is optional — a Redis outage must not pull the container out of rotation, the disk
 * layer still serves every hit. Zero site keys must, though: every signed GET would 503.
 */
healthRoutes.get('/', async (c) => {
  const redis = await cache.ping();
  const sites = config.siteKeys.size;
  const ok = renderService.ready && sites > 0;
  return c.json(
    {
      status: ok ? 'ok' : 'degraded',
      renderer: renderService.ready ? 'ready' : 'booting',
      fontBytes: renderService.loadedFontBytes,
      sites,
      redis,
      queue: renderService.queueDepth,
      inflight: inflightCount(),
      templates: templateNames(),
    },
    ok ? 200 : 503,
  );
});
