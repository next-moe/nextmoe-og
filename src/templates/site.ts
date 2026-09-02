import { z } from 'zod';
import { OG_SIZE, SMALL_WEIGHT, clamp, escapeHtml, palette } from './layout';
import type { Template } from './types';

const SiteSchema = z.object({
  name: z.string().min(1).max(80),
  slogan: z.string().max(160).optional(),
  logo: z.url().max(1000).optional(),
});

export type SiteFields = z.infer<typeof SiteSchema>;

/**
 * The one card that does not carry the corner wordmark, and the one that may use a gradient
 * (CLAUDE.md iron rules 1 and 2 name this file as their only exception — do not "fix" either
 * back). A site card's subject *is* the site name, printed at 92px in the middle of it, so the
 * wordmark under it repeated the same words twice on one image. The gradient is the ground the
 * mark sits on, not decoration on a component.
 */
const ground =
  'background-image:linear-gradient(105deg,#0a0b0f 0%,#0d1526 42%,#132845 74%,#183358 100%)';

/** Warms the corner the mascot occupies so it is lit rather than pasted onto a flat panel. */
const glow = `<div style="position:absolute;top:-160px;right:-140px;width:760px;height:760px;border-radius:9999px;background-image:radial-gradient(circle,rgba(40,129,251,0.28) 0%,rgba(40,129,251,0.07) 45%,rgba(40,129,251,0) 70%)"></div>`;

const rule = `<div style="display:flex;width:96px;height:7px;border-radius:9999px;background-color:${palette.primary};margin-bottom:34px"></div>`;

export const site: Template<SiteFields> = {
  name: 'site',
  size: OG_SIZE,
  schema: SiteSchema,
  images: (f) => (f.logo ? [f.logo] : []),
  html: (f, loaded) => {
    const logo = f.logo && loaded.has(f.logo) ? f.logo : null;
    // 10, not 12: "鲲 Galgame 论坛" is exactly 12 characters and wrapped to two lines at 92px.
    const nameSize = f.name.length > 10 ? 72 : 92;
    const align = logo ? 'flex-start' : 'center';

    const text = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:${align};text-align:${logo ? 'left' : 'center'};width:${logo ? 640 : OG_SIZE.width - 12}px;height:${OG_SIZE.height}px;padding:0 ${logo ? 0 : 96}px 0 ${logo ? 72 : 96}px">
        ${rule}
        <div style="font-size:${nameSize}px;font-weight:800;line-height:1.2;letter-spacing:-1px;${clamp(2)}">${escapeHtml(f.name)}</div>
        ${
          f.slogan
            ? `<div style="margin-top:24px;font-size:28px;font-weight:${SMALL_WEIGHT};line-height:1.45;color:${palette.muted};${clamp(2)}">${escapeHtml(f.slogan)}</div>`
            : ''
        }
      </div>`;

    // Out of flow: an art column in the normal flow stole the width the slogan needed and broke
    // "永远免费" onto a line of its own. Being out of flow it also cannot push the text, so the
    // 640px text column above is what keeps a long name from running under the mascot's hair.
    const art = logo
      ? `<img src="${escapeHtml(logo)}" style="position:absolute;top:126px;right:0;width:546px;height:380px;object-fit:contain" />`
      : '';

    return `<div style="position:relative;width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;${ground};color:${palette.fg};display:flex;flex-direction:row;font-family:'NextMoe Sans','NextMoe SC','NextMoe JP'">
      ${glow}
      <div style="width:12px;height:${OG_SIZE.height}px;background-color:${palette.primary}"></div>
      ${text}
      ${art}
    </div>`;
  },
  sample: {
    name: '鲲 Galgame',
    slogan: '世界上最萌的 Galgame 论坛 · 永远免费',
    logo: 'https://www.kungal.com/kungalgame.webp',
  },
};
