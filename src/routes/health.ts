import { Hono } from 'hono';
import { inflightCount } from '../cache/single-flight';
import { cache } from '../cache/store';
import { renderService } from '../render/renderer';
import { templateNames } from '../templates';

export const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  const redis = await cache.ping();
  const ok = renderService.ready && redis !== 'down';
  return c.json(
    {
      status: ok ? 'ok' : 'degraded',
      renderer: renderService.ready ? 'ready' : 'booting',
      fontBytes: renderService.loadedFontBytes,
      redis,
      queue: renderService.queueDepth,
      inflight: inflightCount(),
      templates: templateNames(),
    },
    ok ? 200 : 503,
  );
});
