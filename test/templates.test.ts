import { describe, expect, it } from 'vitest';
import { allTemplates, getTemplate, templateNames } from '../src/templates';
import { OG_BRAND, brandFor } from '../src/templates/layout';

const templates = allTemplates();

/**
 * A sentinel rather than a real brand: the site card's own sample name is a site name, so
 * asserting "appears exactly once" against a real wordmark counts the subject of the card too.
 */
const SENTINEL = '@@wordmark@@';

/**
 * `site` is the sanctioned exception to both card-level iron rules — see the block comment in
 * src/templates/site.ts. Every other template still has to satisfy them.
 */
const branded = templates.filter((t) => t.name !== 'site');

const draw = (
  t: (typeof templates)[number],
  fields: unknown,
  loaded: string[] = [],
  brand: string = OG_BRAND,
): string => t.html(fields as never, new Set(loaded), brand);

describe('registry', () => {
  it('holds the seven planned templates and nothing else', () => {
    expect(templateNames().sort()).toEqual(
      ['character', 'label', 'patch', 'person', 'site', 'topic', 'work'].sort(),
    );
    expect(getTemplate('nope')).toBeUndefined();
  });
});

describe.each(templates.map((t) => [t.name, t] as const))('%s', (_name, t) => {
  it('accepts its own sample', () => {
    expect(t.schema.safeParse(t.sample).success).toBe(true);
  });

  it('renders at the default OG size', () => {
    expect(t.size).toEqual({ width: 1200, height: 630 });
  });

  it('emits no <img> for an image the pre-fetch did not load', () => {
    const html = draw(t, t.sample, []);
    expect(html).not.toContain('<img');
  });

  it('emits an <img> for every url the pre-fetch did load', () => {
    const urls = t.images(t.sample as never);
    const html = draw(t, t.sample, urls);
    for (const url of urls) expect(html).toContain(url);
  });
});

describe.each(branded.map((t) => [t.name, t] as const))('%s', (_name, t) => {
  it('carries the signing site wordmark exactly once', () => {
    const html = draw(t, t.sample, t.images(t.sample as never), SENTINEL);
    expect(html.split(SENTINEL)).toHaveLength(2);
  });

  it('uses no gradient anywhere', () => {
    expect(draw(t, t.sample, t.images(t.sample as never))).not.toMatch(/gradient\(/);
  });
});

describe('site', () => {
  it('is the one card with a gradient ground and no wordmark', () => {
    const t = getTemplate('site')!;
    const html = draw(t, t.sample, t.images(t.sample as never), SENTINEL);
    expect(html).not.toContain(SENTINEL);
    expect(html).toMatch(/gradient\(/);
  });
});

describe('brand', () => {
  it('names the signing site, and falls back to the ecosystem', () => {
    expect(OG_BRAND).toBe('NextMoe·未萌');
    expect(brandFor('forum')).toBe('鲲 Galgame 论坛');
    expect(brandFor('letmoe')).toBe(OG_BRAND);
    expect(brandFor(null)).toBe(OG_BRAND);
    expect(brandFor('')).toBe(OG_BRAND);
  });
});

describe('escaping', () => {
  it('neutralises markup arriving in a field', () => {
    const work = getTemplate('work')!;
    const fields = work.schema.parse({
      title: '<script>alert("x")</script>',
      label: '"quoted" & <b>',
    });
    const html = draw(work, fields);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});
