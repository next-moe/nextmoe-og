import { z } from 'zod';
import {
  badgeRow,
  clamp,
  compactCount,
  escapeHtml,
  figure,
  fontStack,
  metaBar,
  OG_SIZE,
  palette,
  SMALL_WEIGHT,
  splitCard,
  visualColumn,
} from './layout';
import type { Template } from './types';

const WorkSchema = z.object({
  title: z.string().min(1).max(200),
  originalName: z.string().max(200).optional(),
  cover: z.url().max(1000).optional(),
  label: z.string().max(80).optional(),
  releaseDate: z.string().max(40).optional(),
  rating: z.number().min(0).max(10).optional(),
  ratingCount: z.number().int().nonnegative().max(999_999).optional(),
  badges: z.array(z.string().max(24)).max(4).default([]),
});

export type WorkFields = z.infer<typeof WorkSchema>;

export const work: Template<WorkFields> = {
  name: 'work',
  size: OG_SIZE,
  schema: WorkSchema,
  images: (f) => (f.cover ? [f.cover] : []),
  html: (f, loaded, brand) => {
    const cover = f.cover && loaded.has(f.cover) ? f.cover : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:56px;font-weight:800;line-height:1.3;${clamp(2)}">${escapeHtml(f.title)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:29px;font-weight:${SMALL_WEIGHT};line-height:1.4;color:${palette.muted};font-family:${fontStack.jp};${clamp(f.rating === undefined ? 2 : 1)}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${f.rating === undefined ? '' : figure(f.rating.toFixed(1), '评分', f.ratingCount === undefined ? undefined : `${compactCount(f.ratingCount)} 人`)}
    `;
    return splitCard(
      visualColumn(cover, f.title.slice(0, 1)),
      body,
      metaBar([f.label ?? '', f.releaseDate ?? ''], brand),
    );
  },
  sample: {
    title: '素晴らしき日々〜不連続存在〜',
    originalName: 'Subarashiki Hibi ~Furenzoku Sonzai~',
    label: 'ケロQ',
    releaseDate: '2010-03-26',
    rating: 9.2,
    ratingCount: 148,
    badges: ['ADV', '18+'],
  },
};
