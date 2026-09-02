import { z } from 'zod';
import {
  badgeRow,
  clamp,
  clampOne,
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

const LabelSchema = z.object({
  name: z.string().min(1).max(120),
  originalName: z.string().max(120).optional(),
  logo: z.url().max(1000).optional(),
  workCount: z.number().int().nonnegative().max(99_999).optional(),
  founded: z.string().max(40).optional(),
  badges: z.array(z.string().max(24)).max(4).default([]),
});

export type LabelFields = z.infer<typeof LabelSchema>;

export const label: Template<LabelFields> = {
  name: 'label',
  size: OG_SIZE,
  schema: LabelSchema,
  images: (f) => (f.logo ? [f.logo] : []),
  html: (f, loaded, brand) => {
    const logo = f.logo && loaded.has(f.logo) ? f.logo : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:64px;font-weight:800;line-height:1.18;font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.name)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;font-weight:${SMALL_WEIGHT};line-height:1.4;color:${palette.muted};${clampOne}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${f.workCount === undefined ? '' : figure(String(f.workCount), '部作品')}
    `;
    return splitCard(
      visualColumn(logo, f.name.slice(0, 1), 468, 'contain'),
      body,
      metaBar([f.founded ?? ''], brand),
    );
  },
  sample: {
    name: 'ケロQ',
    originalName: 'KeroQ',
    workCount: 12,
    founded: '2001 年成立',
    badges: ['会社'],
  },
};
