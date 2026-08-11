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
app.notFound((c) => c.json({ error: 'not_found' }, 404));

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

const server = serve({ fetch: app.fetch, hostname: config.HOST, port: config.PORT }, (info) => {
  log.info(
    { host: config.HOST, port: info.port, sites: config.siteKeys.size, redis: cache.redisEnabled },
    'og service listening',
  );
});

void renderService
  .warmup()
  .catch((e: Error) => log.error({ err: e.message }, 'renderer warmup failed'));

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'shutting down');
  clearInterval(evictionTimer);
  server.close();
  renderService.shutdown();
  await cache.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
