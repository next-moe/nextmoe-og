import { z } from 'zod';
import {
  badgeRow,
  clamp,
  clampOne,
  escapeHtml,
  field,
  fontStack,
  metaBar,
  OG_SIZE,
  palette,
  SMALL_WEIGHT,
  splitCard,
  visualColumn,
} from './layout';
import type { Template } from './types';

const PersonSchema = z.object({
  name: z.string().min(1).max(120),
  originalName: z.string().max(120).optional(),
  photo: z.url().max(1000).optional(),
  works: z.array(z.string().max(120)).max(3).default([]),
  badges: z.array(z.string().max(24)).max(4).default([]),
});

export type PersonFields = z.infer<typeof PersonSchema>;

export const person: Template<PersonFields> = {
  name: 'person',
  size: OG_SIZE,
  schema: PersonSchema,
  images: (f) => (f.photo ? [f.photo] : []),
  html: (f, loaded, brand) => {
    const photo = f.photo && loaded.has(f.photo) ? f.photo : null;
    const works = f.works
      .map(
        (w) =>
          `<div style="display:flex;flex-direction:row;align-items:center;margin-top:9px;font-size:27px;font-weight:${SMALL_WEIGHT};line-height:1.3;color:${palette.fg};font-family:${fontStack.jp}">
             <div style="width:9px;height:9px;border-radius:9999px;background-color:${palette.primary};margin-right:18px"></div>
             <div style="flex:1;${clamp(1)}">${escapeHtml(w)}</div>
           </div>`,
      )
      .join('');
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:62px;font-weight:800;line-height:1.18;font-family:${fontStack.jp};${clamp(works ? 1 : 2)}">${escapeHtml(f.name)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:14px;font-size:30px;font-weight:${SMALL_WEIGHT};line-height:1.4;color:${palette.muted};${clampOne}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${works ? field('代表作', `<div style="display:flex;flex-direction:column">${works}</div>`) : ''}
    `;
    return splitCard(visualColumn(photo, f.name.slice(0, 1)), body, metaBar([], brand));
  },
  sample: {
    name: 'すかぢ',
    originalName: 'SCA-JI',
    works: ['素晴らしき日々〜不連続存在〜', '終ノ空', 'サクラノ詩'],
    badges: ['剧本', '原画'],
  },
};
