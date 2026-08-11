import { z } from 'zod';
import {
  OG_SIZE,
  badgeRow,
  clamp,
  escapeHtml,
  fontStack,
  metaBar,
  palette,
  spacer,
  splitCard,
  visualColumn,
} from './layout';
import type { Template } from './types';

const PatchSchema = z.object({
  title: z.string().min(1).max(200),
  originalName: z.string().max(200).optional(),
  cover: z.url().max(1000).optional(),
  platforms: z.array(z.string().max(24)).max(4).default([]),
  language: z.string().max(40).optional(),
  size: z.string().max(40).optional(),
});

export type PatchFields = z.infer<typeof PatchSchema>;

export const patch: Template<PatchFields> = {
  name: 'patch',
  size: OG_SIZE,
  schema: PatchSchema,
  images: (f) => (f.cover ? [f.cover] : []),
  html: (f, loaded) => {
    const cover = f.cover && loaded.has(f.cover) ? f.cover : null;
    const body = `
      ${badgeRow(f.platforms)}
      <div style="font-size:56px;font-weight:700;line-height:1.24;font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.title)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;color:${palette.muted};${clamp(2)}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${spacer}
      ${metaBar([f.language ?? '', f.size ?? ''])}
    `;
    return splitCard(visualColumn(cover, f.title.slice(0, 1)), body);
  },
  sample: {
    title: 'サクラノ詩 -櫻の森の上を舞う-',
    originalName: 'Sakura no Uta',
    platforms: ['Windows', 'Android'],
    language: '简体中文',
    size: '4.2 GB',
  },
};
