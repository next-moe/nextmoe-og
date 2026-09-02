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
 * back). A site card's subject *is* the site name, printed large in the middle of it, so the
 * wordmark under it repeated the same words twice on one image. The gradients here are the
 * ground the mark sits on and the scrim that keeps text off the art, not decoration.
 */
const ground =
  'background-image:linear-gradient(105deg,#0e1c33 0%,#0b1526 34%,#0a0d16 68%,#08090c 100%)';

/** Lights the art from behind so a pale character is not a bright shape on a flat panel. */
const glow = `<div style="position:absolute;left:-170px;top:-120px;width:900px;height:900px;border-radius:9999px;background-image:radial-gradient(circle,rgba(40,129,251,0.30) 0%,rgba(40,129,251,0.09) 44%,rgba(40,129,251,0) 70%)"></div>`;

/**
 * The art is card-sized and bleeds, so it runs the full width and the text would sit on top of
 * it. This fades it out under the text column instead of cutting it: a hard-cropped column left
 * a vertical slice through the middle of the character's dress that read as a broken image.
 */
const scrim = `<div style="position:absolute;left:0;top:0;width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;background-image:linear-gradient(80deg,rgba(9,12,20,0) 0%,rgba(9,12,20,0) 30%,rgba(9,12,20,0.52) 42%,rgba(9,12,20,0.88) 53%,#0a0d17 64%,#0a0d17 100%)"></div>`;

const rule = `<div style="display:flex;width:88px;height:7px;border-radius:9999px;background-color:${palette.primary};margin-bottom:30px"></div>`;

/**
 * A mascot rendered inside a right-hand column came out about 100px of face on a 1200px card,
 * which is a smudge once a timeline scales the card to 500px. Legibility needs the art at
 * roughly card width, which means it has to bleed rather than fit.
 */
const ART = { width: 1080, height: 608, left: 0, top: 8 } as const;

export const site: Template<SiteFields> = {
  name: 'site',
  size: OG_SIZE,
  schema: SiteSchema,
  images: (f) => (f.logo ? [f.logo] : []),
  html: (f, loaded) => {
    const logo = f.logo && loaded.has(f.logo) ? f.logo : null;
    const nameSize =
      f.name.length > 24 ? 44 : f.name.length > 14 ? 52 : f.name.length > 9 ? 70 : 80;

    const text = logo
      ? `<div style="position:absolute;right:0;top:0;display:flex;flex-direction:column;justify-content:center;width:624px;height:${OG_SIZE.height}px;padding-right:68px">
           ${rule}
           <div style="font-size:${nameSize}px;font-weight:800;line-height:1.16;letter-spacing:-1px;${clamp(2)}">${escapeHtml(f.name)}</div>
           ${
             f.slogan
               ? `<div style="margin-top:22px;font-size:27px;font-weight:${SMALL_WEIGHT};line-height:1.5;color:${palette.muted};${clamp(3)}">${escapeHtml(f.slogan)}</div>`
               : ''
           }
         </div>`
      : `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;width:${OG_SIZE.width - 12}px;height:${OG_SIZE.height}px;padding:0 96px">
           ${rule}
           <div style="font-size:${nameSize}px;font-weight:800;line-height:1.16;letter-spacing:-1px;${clamp(2)}">${escapeHtml(f.name)}</div>
           ${
             f.slogan
               ? `<div style="margin-top:22px;font-size:28px;font-weight:${SMALL_WEIGHT};line-height:1.5;color:${palette.muted};${clamp(2)}">${escapeHtml(f.slogan)}</div>`
               : ''
           }
         </div>`;

    const art = logo
      ? `<img src="${escapeHtml(logo)}" style="position:absolute;left:${ART.left}px;top:${ART.top}px;width:${ART.width}px;height:${ART.height}px;object-fit:contain" />${scrim}`
      : '';

    return `<div style="position:relative;width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;${ground};color:${palette.fg};display:flex;flex-direction:row;font-family:'NextMoe Sans','NextMoe SC','NextMoe JP'">
      ${glow}
      ${art}
      <div style="width:12px;height:${OG_SIZE.height}px;background-color:${palette.primary}"></div>
      ${text}
    </div>`;
  },
  sample: {
    name: '鲲 Galgame',
    slogan: '世界上最萌的 Galgame 论坛 · 永远免费',
    logo: 'https://www.kungal.com/kungalgame.webp',
  },
};
