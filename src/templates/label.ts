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
  html: (f, loaded) => {
    const logo = f.logo && loaded.has(f.logo) ? f.logo : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:64px;font-weight:700;line-height:1.2;font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.name)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;color:${palette.muted};${clamp(1)}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${
        f.workCount === undefined
          ? ''
          : `<div style="display:flex;flex-direction:row;align-items:flex-end;margin-top:36px">
               <div style="font-size:72px;font-weight:700;color:${palette.primary};line-height:1">${f.workCount}</div>
               <div style="font-size:28px;color:${palette.muted};margin-left:14px;margin-bottom:8px">部作品</div>
             </div>`
      }
      ${spacer}
      ${metaBar([f.founded ?? ''])}
    `;
    return splitCard(visualColumn(logo, f.name.slice(0, 1), 440, 'contain'), body);
  },
  sample: {
    name: 'ケロQ',
    originalName: 'KeroQ',
    workCount: 12,
    founded: '2001 年成立',
    badges: ['会社'],
  },
};
