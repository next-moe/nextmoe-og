import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cache } from './cache/store';
import { config } from './config';
import { log } from './log';
import { renderService } from './render/renderer';
import { healthRoutes } from './routes/health';
import { ogRoutes } from './routes/og';

const app = new Hono();

app.use('*', async (c, next) => {
  const started = performance.now();
  await next();
  log.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      cache: c.res.headers.get('x-cache'),
      ms: Math.round(performance.now() - started),
    },
    'req',
  );
});

app.route('/health', healthRoutes);
app.route('/v1/og', ogRoutes);

if (config.NODE_ENV !== 'production') {
  const { previewRoutes } = await import('./routes/preview');
  app.route('/preview', previewRoutes);
  log.info('preview page mounted at /preview');
}
app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  log.error({ err: err.message, path: c.req.path }, 'unhandled route error');
  return c.json({ error: 'internal' }, 500);
});

const evictionTimer = setInterval(
  () => {
    void cache
      .evictToCap()
      .then((n) => n > 0 && log.info({ evicted: n }, 'cache evicted'))
      .catch((e: Error) => log.warn({ err: e.message }, 'cache eviction failed'));
  },
  5 * 60 * 1000,
);
evictionTimer.unref?.();

// Boot the renderer before listening. A missing font file is unrecoverable — serving anyway
// would leave a container that passes its port check and 500s every render.
try {
  await renderService.warmup();
} catch (e) {
  log.error({ err: (e as Error).message }, 'renderer warmup failed');
  process.exit(1);
}

const server = serve({ fetch: app.fetch, hostname: config.HOST, port: config.PORT }, (info) => {
  log.info(
    { host: config.HOST, port: info.port, sites: config.siteKeys.size, redis: cache.redisEnabled },
    'og service listening',
  );
});

const DRAIN_MS = 15_000;
const FLUSH_MS = 5_000;

const after = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'shutting down');
  clearInterval(evictionTimer);
  // The close callback fires only once every connection has ended, so it has to be registered
  // before the drain: process.exit() does not flush sockets, and the render that finishes last
  // would otherwise have its response cut off mid-write.
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  await renderService.drain(DRAIN_MS);
  // Keep-alive sockets a crawler left open would hold close() forever; only http.Server has this.
  if ('closeIdleConnections' in server) server.closeIdleConnections();
  await Promise.race([closed, after(FLUSH_MS)]);
  await cache.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
