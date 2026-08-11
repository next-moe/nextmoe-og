import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { allTemplates, getTemplate, templateNames } from '../src/templates';

const templates = allTemplates();

const draw = (t: (typeof templates)[number], fields: unknown, loaded: string[] = []): string =>
  t.html(fields as never, new Set(loaded));

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

  it('renders at the default OG size with the wordmark exactly once', () => {
    const html = draw(t, t.sample, t.images(t.sample as never));
    expect(t.size).toEqual({ width: 1200, height: 630 });
    expect(html.split(config.OG_BRAND)).toHaveLength(2);
    expect(config.OG_BRAND).toBe('NextMoe·未萌');
  });

  it('uses no gradient anywhere', () => {
    expect(draw(t, t.sample, t.images(t.sample as never))).not.toMatch(/gradient\(/);
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
