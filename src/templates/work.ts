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

const WorkSchema = z.object({
  title: z.string().min(1).max(200),
  originalName: z.string().max(200).optional(),
  cover: z.url().max(1000).optional(),
  label: z.string().max(80).optional(),
  releaseDate: z.string().max(40).optional(),
  badges: z.array(z.string().max(24)).max(4).default([]),
});

export type WorkFields = z.infer<typeof WorkSchema>;

export const work: Template<WorkFields> = {
  name: 'work',
  size: OG_SIZE,
  schema: WorkSchema,
  images: (f) => (f.cover ? [f.cover] : []),
  html: (f, loaded) => {
    const cover = f.cover && loaded.has(f.cover) ? f.cover : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:56px;font-weight:700;line-height:1.24;${clamp(2)}">${escapeHtml(f.title)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;color:${palette.muted};font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${spacer}
      ${metaBar([f.label ?? '', f.releaseDate ?? ''])}
    `;
    return splitCard(visualColumn(cover, f.title.slice(0, 1)), body);
  },
};
