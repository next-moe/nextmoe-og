export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Iron rule: exact casing, U+00B7, no spaces, once per card. Deliberately not an env var —
 * it names the ecosystem, so a deploy must not be able to change it.
 */
export const OG_BRAND = 'NextMoe·未萌';

/**
 * A card is signed by one site and carries that site's own name, so a forum topic does not go
 * out branded as the patch site. Keyed by the site id in OG_SITE_KEYS; anything unlisted keeps
 * the ecosystem name. Because the wordmark now varies per site, the site is part of the cache
 * key — without it two sites signing the same payload share one entry and the second is served
 * the first one's brand.
 */
const SITE_BRANDS: Record<string, string> = {
  forum: '鲲 Galgame 论坛',
};

export const brandFor = (site: string | null | undefined): string =>
  (site && SITE_BRANDS[site]) || OG_BRAND;

export const palette = {
  bg: '#0a0b0f',
  panel: '#12141c',
  surface: '#171a23',
  surfaceAlt: '#1c1f2a',
  line: '#272b37',
  fg: '#f2f4f8',
  muted: '#a7b0c0',
  dim: '#7f889b',
  primary: '#2881fb',
  primarySoft: '#6ba6ff',
  primaryInk: '#122744',
  secondary: '#e315b2',
  warning: '#b67700',
  success: '#299e62',
} as const;

export const fontStack = {
  jp: "'NextMoe Sans','NextMoe JP','NextMoe SC'",
  sc: "'NextMoe Sans','NextMoe SC','NextMoe JP'",
  latin: "'NextMoe Sans','NextMoe SC','NextMoe JP'",
} as const;

export const escapeHtml = (raw: string): string =>
  raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Multi-line truncation. `display: -webkit-box` throws InvalidArg in takumi; bare `line-clamp` is the one that works. */
export const clamp = (lines: number): string =>
  `line-clamp:${lines};overflow:hidden;text-overflow:ellipsis`;

export const clampOne = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

export const spacer = '<div style="flex:1"></div>';

/**
 * Filled chips, not outlined ones. The old row gave every badge its own hue off a 4-colour
 * cycle, which read as a swatch test at timeline size; the accent now appears in one place
 * per card and everything else stays neutral.
 */
export const chip = (text: string, tone: 'accent' | 'neutral' = 'neutral'): string => {
  const skin =
    tone === 'accent'
      ? `background-color:${palette.primaryInk};color:${palette.primarySoft}`
      : `background-color:${palette.surfaceAlt};color:${palette.muted}`;
  return `<div style="display:flex;${skin};font-size:23px;font-weight:700;border-radius:10px;padding:9px 20px">${escapeHtml(text)}</div>`;
};

export const badgeRow = (items: string[], tone: 'accent' | 'neutral' = 'neutral'): string =>
  items.length === 0
    ? ''
    : `<div style="display:flex;flex-direction:row;gap:12px;margin-bottom:26px">${items
        .slice(0, 4)
        .map((text) => chip(text, tone))
        .join('')}</div>`;

/**
 * Weights below 500 are what a downscaled card loses first: at timeline size Noto's 400 on a
 * dark ground reads as grey haze rather than text. Nothing small is set lighter than 500, and
 * captions carry 600 to survive the letter-spacing.
 */
export const SMALL_WEIGHT = 500;
export const CAPTION_WEIGHT = 600;

/** A small letterspaced caption over its value. Gives a lone line of text somewhere to belong. */
export const field = (label: string, value: string): string =>
  `<div style="display:flex;flex-direction:column;margin-top:26px">
     <div style="display:flex;font-size:21px;font-weight:${CAPTION_WEIGHT};color:${palette.dim};letter-spacing:3px;margin-bottom:9px">${escapeHtml(label)}</div>
     ${value}
   </div>`;

/** The card's one large number: a rating, a work count. Carries the accent for the whole card. */
export const figure = (value: string, label: string, caption?: string): string =>
  `<div style="display:flex;flex-direction:row;align-items:center;margin-top:36px">
     <div style="font-size:76px;font-weight:800;line-height:1;color:${palette.primary};font-variant-numeric:tabular-nums">${escapeHtml(value)}</div>
     <div style="display:flex;flex-direction:column;margin-left:18px">
       <div style="display:flex;font-size:22px;font-weight:${CAPTION_WEIGHT};color:${palette.muted};letter-spacing:3px">${escapeHtml(label)}</div>
       ${caption === undefined ? '' : `<div style="display:flex;font-size:22px;font-weight:${SMALL_WEIGHT};color:${palette.dim};margin-top:6px">${escapeHtml(caption)}</div>`}
     </div>
   </div>`;

/**
 * A view count runs to eight digits, and "98,765,432 浏览" pushed the byline straight through
 * the wordmark. Chinese pages count in 万 anyway, so nothing here is ever wider than six glyphs.
 */
export const compactCount = (n: number): string => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString('en-US');
};

/**
 * A count and the thing it counts, on one line. The stacked number-over-unit variant this
 * replaced read as a dashboard tile; a forum byline wants "1,234 浏览" the way the page says it.
 * Both halves are nowrap: without it the band squeezed "浏览" into a two-glyph column.
 */
export const metric = (value: number, unit: string): string =>
  `<div style="display:flex;flex-direction:row;align-items:center;flex-shrink:0">
     <div style="font-size:30px;font-weight:700;color:${palette.fg};font-variant-numeric:tabular-nums;white-space:nowrap">${escapeHtml(compactCount(value))}</div>
     <div style="font-size:24px;font-weight:${SMALL_WEIGHT};color:${palette.dim};margin-left:9px;white-space:nowrap">${escapeHtml(unit)}</div>
   </div>`;

export const metricRow = (items: string[]): string => {
  const kept = items.filter(Boolean);
  return kept.length === 0
    ? ''
    : `<div style="display:flex;flex-direction:row;align-items:center;gap:30px;flex-shrink:0">${kept.join('')}</div>`;
};

/**
 * The card's floor: a solid slab rather than a hairline rule. Every template ends on one, so
 * the empty middle of a short card reads as composition instead of as a layout that ran out.
 */
export const band = (left: string, right: string): string =>
  `<div style="display:flex;flex-direction:row;align-items:center;background-color:${palette.panel};border-radius:22px;padding:22px 30px;min-height:96px;flex-shrink:0">
     ${left}
     ${spacer}
     ${right}
   </div>`;

export const wordmark = (brand: string): string =>
  `<div style="display:flex;flex-shrink:0;font-size:25px;font-weight:800;color:${palette.primary};font-family:${fontStack.sc};letter-spacing:0.5px;white-space:nowrap">${escapeHtml(brand)}</div>`;

const dotted = (parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((p) => `<div style="display:flex;${clampOne}">${escapeHtml(p)}</div>`)
    .join(`<div style="display:flex;margin:0 14px;color:${palette.dim}">·</div>`);

export const metaBar = (parts: string[], brand: string): string =>
  band(
    `<div style="display:flex;flex-direction:row;align-items:center;overflow:hidden;margin-right:24px;font-size:26px;font-weight:${SMALL_WEIGHT};color:${palette.muted};font-family:${fontStack.jp}">${dotted(parts)}</div>`,
    wordmark(brand),
  );

/**
 * Left visual column: the cover when its bytes arrived, a lettermark block when they did not.
 * `fit` is 'contain' for art that must not be cropped — transparent character portraits, logos.
 */
export const visualColumn = (
  src: string | null,
  fallbackLetter: string,
  width = 468,
  fit: 'cover' | 'contain' = 'cover',
): string => {
  const frame = `width:${width}px;height:${OG_SIZE.height}px;background-color:${palette.surface};display:flex;align-items:center;justify-content:center`;
  return src
    ? `<div style="${frame}"><img src="${escapeHtml(src)}" style="width:${width}px;height:${OG_SIZE.height}px;object-fit:${fit}" /></div>`
    : `<div style="${frame}">${lettermark(fallbackLetter)}</div>`;
};

/**
 * The no-cover placeholder. A bare 150px glyph in the hairline colour read as a broken
 * skeleton loader; a tile with the letter in muted on a lighter surface reads as a choice.
 */
export const lettermark = (letter: string, size = 176): string =>
  `<div style="width:${size}px;height:${size}px;border-radius:36px;background-color:${palette.surfaceAlt};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.5)}px;font-weight:800;color:${palette.dim}">${escapeHtml(letter)}</div>`;

/** Small round portrait for by-lines. Falls back to a lettermark of the same diameter. */
export const avatar = (src: string | null, fallbackLetter: string, size = 64): string => {
  const frame = `width:${size}px;height:${size}px;border-radius:9999px;background-color:${palette.surfaceAlt};display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0`;
  return src
    ? `<div style="${frame}"><img src="${escapeHtml(src)}" style="width:${size}px;height:${size}px;object-fit:cover" /></div>`
    : `<div style="${frame};font-size:${Math.round(size * 0.44)}px;font-weight:800;color:${palette.muted}">${escapeHtml(fallbackLetter)}</div>`;
};

const shell = (inner: string): string =>
  `<div style="width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;background-color:${palette.bg};color:${palette.fg};display:flex;flex-direction:row;font-family:${fontStack.sc}">${inner}</div>`;

/** The accent stripe down the left edge. The one mark that survives being scaled to a thumbnail. */
const rail = `<div style="width:12px;height:${OG_SIZE.height}px;background-color:${palette.primary}"></div>`;

/**
 * Body and footer are separate arguments because they were once one string with a flex spacer
 * between them: at maximum field lengths the body drew over the footer instead of pushing it
 * down. The body now sits in a `flex:1` box that clips. The inner `flex-shrink:0` wrapper is
 * the other half of that fix — without it flex shrank the text blocks themselves, and a line
 * squeezed to half its height was rendered cut through the middle of its glyphs.
 */
const column = (body: string, footer: string, pad: string, center = false): string =>
  `<div style="flex:1;display:flex;flex-direction:column;gap:28px;padding:${pad}">
     <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;justify-content:${center ? 'center' : 'flex-start'}">
       <div style="display:flex;flex-direction:column;flex-shrink:0">${body}</div>
     </div>
     ${footer}
   </div>`;

/** Left visual + right text column. The skeleton every entity template shares. */
export const splitCard = (visual: string, body: string, footer: string): string =>
  shell(`${visual}${column(body, footer, '52px 52px 44px 52px')}`);

/** Full-bleed image band with the information below it. The other shared skeleton. */
export const bannerCard = (background: string | null, body: string, footer: string): string =>
  shell(
    `${rail}
     <div style="flex:1;display:flex;flex-direction:column">
       ${
         background
           ? `<img src="${escapeHtml(background)}" style="width:${OG_SIZE.width - 12}px;height:268px;object-fit:cover" />`
           : `<div style="width:${OG_SIZE.width - 12}px;height:268px;background-color:${palette.surface}"></div>`
       }
       ${column(body, footer, '40px 56px 40px 52px')}
     </div>`,
  );

/** No visual at all: rail plus one padded column. For cards whose subject is text. */
export const textCard = (body: string, footer: string, center = false): string =>
  shell(`${rail}${column(body, footer, '58px 56px 44px 52px', center)}`);
