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

const CharacterSchema = z.object({
  name: z.string().min(1).max(120),
  originalName: z.string().max(120).optional(),
  portrait: z.url().max(1000).optional(),
  work: z.string().max(200).optional(),
  voice: z.string().max(80).optional(),
  badges: z.array(z.string().max(24)).max(4).default([]),
});

export type CharacterFields = z.infer<typeof CharacterSchema>;

export const character: Template<CharacterFields> = {
  name: 'character',
  size: OG_SIZE,
  schema: CharacterSchema,
  images: (f) => (f.portrait ? [f.portrait] : []),
  html: (f, loaded, brand) => {
    const portrait = f.portrait && loaded.has(f.portrait) ? f.portrait : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:62px;font-weight:800;line-height:1.18;font-family:${fontStack.jp};${clamp(f.work ? 1 : 2)}">${escapeHtml(f.name)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;font-weight:${SMALL_WEIGHT};line-height:1.4;color:${palette.muted};${clampOne}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${
        f.work
          ? field(
              '所属作品',
              `<div style="font-size:31px;font-weight:${SMALL_WEIGHT};line-height:1.4;color:${palette.fg};font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.work)}</div>`,
            )
          : ''
      }
    `;
    return splitCard(
      visualColumn(portrait, f.name.slice(0, 1), 468, 'contain'),
      body,
      metaBar([f.voice ?? ''], brand),
    );
  },
  sample: {
    name: '間宮 卓司',
    originalName: 'Mamiya Takuji',
    work: '素晴らしき日々〜不連続存在〜',
    voice: 'CV. 佐藤 心',
    badges: ['主人公'],
  },
};
