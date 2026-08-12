import PQueue from 'p-queue';
import { render } from 'takumi-js';
import { Renderer } from 'takumi-js/node';
import { config } from '../config';
import { log } from '../log';
import { registerFonts } from './fonts';
import { loadImages } from './images';
import type { Template } from '../templates/types';

export class QueueFullError extends Error {
  constructor() {
    super('render queue full');
  }
}

export interface RenderResult {
  body: Buffer;
  contentType: string;
  format: 'webp' | 'png';
  /** At least one cover the template asked for never arrived; the card fell back to a lettermark. */
  degraded: boolean;
}

class RenderService {
  private renderer: Renderer | null = null;
  private booting: Promise<Renderer> | null = null;
  private fontBytes = 0;
  private readonly queue = new PQueue({ concurrency: config.RENDER_CONCURRENCY });

  get queueDepth(): number {
    return this.queue.size + this.queue.pending;
  }

  get ready(): boolean {
    return this.renderer !== null;
  }

  get loadedFontBytes(): number {
    return this.fontBytes;
  }

  warmup = async (): Promise<void> => {
    await this.getRenderer();
  };

  private getRenderer = async (): Promise<Renderer> => {
    if (this.renderer) return this.renderer;
    if (this.booting) return this.booting;
    this.booting = this.boot().finally(() => {
      this.booting = null;
    });
    return this.booting;
  };

  private boot = async (): Promise<Renderer> => {
    const started = performance.now();
    const renderer = new Renderer();
    this.fontBytes = await registerFonts(renderer);
    this.renderer = renderer;
    log.info(
      { ms: Math.round(performance.now() - started), fontBytes: this.fontBytes },
      'renderer ready',
    );
    return renderer;
  };

  draw = async <F>(template: Template<F>, fields: F): Promise<RenderResult> => {
    if (config.RENDER_QUEUE_MAX > 0 && this.queue.size >= config.RENDER_QUEUE_MAX)
      throw new QueueFullError();
    const result = await this.queue.add(() => this.run(template, fields));
    return result as RenderResult;
  };

  private run = async <F>(template: Template<F>, fields: F): Promise<RenderResult> => {
    const started = performance.now();
    const renderer = await this.getRenderer();
    const wanted = [...new Set(template.images(fields))];
    const images = await loadImages(wanted);
    const loaded = new Set(images.map((i) => i.src));
    const html = template.html(fields, loaded);
    const format = config.RENDER_FORMAT;
    const body = await render(html, {
      renderer,
      width: template.size.width,
      height: template.size.height,
      format,
      ...(format === 'webp' ? { quality: config.RENDER_QUALITY } : {}),
      images,
      // Default 'twemoji' pulls emoji PNGs from a CDN on every render; the Noto files cover our symbols.
      emoji: 'from-font',
      signal: AbortSignal.timeout(config.RENDER_TIMEOUT_MS),
    });
    log.debug(
      {
        template: template.name,
        images: images.length,
        bytes: body.length,
        ms: Math.round(performance.now() - started),
      },
      'rendered',
    );
    return {
      body: Buffer.from(body),
      contentType: format === 'webp' ? 'image/webp' : 'image/png',
      format,
      degraded: images.length < wanted.length,
    };
  };

  /** Let what is already accepted finish. Clearing the queue would hang those callers instead. */
  drain = async (ms: number): Promise<void> => {
    if (this.queueDepth === 0) return;
    log.info({ depth: this.queueDepth }, 'draining render queue');
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.queue.onIdle(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
    clearTimeout(timer);
  };
}

export const renderService = new RenderService();
