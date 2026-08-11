import pino from 'pino';
import { config } from './config';

export const log = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});
