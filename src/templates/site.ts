import { z } from 'zod';
import { OG_SIZE, clamp, escapeHtml, metaBar, palette, textCard } from './layout';
import type { Template } from './types';

const SiteSchema = z.object({
  name: z.string().min(1).max(80),
  slogan: z.string().max(160).optional(),
  logo: z.url().max(1000).optional(),
});

export type SiteFields = z.infer<typeof SiteSchema>;

export const site: Template<SiteFields> = {
  name: 'site',
  size: OG_SIZE,
  schema: SiteSchema,
  images: (f) => (f.logo ? [f.logo] : []),
  html: (f, loaded) => {
    const logo = f.logo && loaded.has(f.logo) ? f.logo : null;
    const center = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">
        ${
          logo
            ? `<img src="${escapeHtml(logo)}" style="width:140px;height:140px;object-fit:contain;margin-bottom:40px" />`
            : ''
        }
        <div style="font-size:88px;font-weight:700;line-height:1.16;text-align:center;${clamp(2)}">${escapeHtml(f.name)}</div>
        ${
          f.slogan
            ? `<div style="margin-top:28px;font-size:34px;color:${palette.muted};line-height:1.4;text-align:center;${clamp(2)}">${escapeHtml(f.slogan)}</div>`
            : ''
        }
      </div>`;
    return textCard(center + metaBar([]));
  },
  sample: {
    name: 'letmoe',
    slogan: 'Galgame 条目库 · 作品、角色、会社与人',
  },
};
