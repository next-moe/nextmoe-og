import type { MiddlewareHandler } from 'hono';
import { config } from '../config';
import { bearerSite } from '../security/signature';

/** The verified site travels in a context variable; every render needs it for the wordmark. */
export type SiteEnv = { Variables: { site: string } };

export const bearerAuth: MiddlewareHandler<SiteEnv> = async (c, next) => {
  if (config.siteKeys.size === 0) return c.json({ error: 'service_unconfigured' }, 503);
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const site = token ? bearerSite(token) : null;
  if (!site) return c.json({ error: 'unauthorized' }, 401);
  c.set('site', site);
  await next();
};
