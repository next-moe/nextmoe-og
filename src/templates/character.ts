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
  html: (f, loaded) => {
    const portrait = f.portrait && loaded.has(f.portrait) ? f.portrait : null;
    const body = `
      ${badgeRow(f.badges)}
      <div style="font-size:60px;font-weight:700;line-height:1.2;font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.name)}</div>
      ${
        f.originalName
          ? `<div style="margin-top:16px;font-size:30px;color:${palette.muted};${clamp(1)}">${escapeHtml(f.originalName)}</div>`
          : ''
      }
      ${
        f.work
          ? `<div style="margin-top:28px;font-size:32px;color:${palette.fg};font-family:${fontStack.jp};${clamp(2)}">${escapeHtml(f.work)}</div>`
          : ''
      }
      ${spacer}
      ${metaBar([f.voice ?? ''])}
    `;
    return splitCard(visualColumn(portrait, f.name.slice(0, 1), 440, 'contain'), body);
  },
  sample: {
    name: '間宮 卓司',
    originalName: 'Mamiya Takuji',
    work: '素晴らしき日々〜不連続存在〜',
    voice: 'CV. 佐藤 心',
    badges: ['主人公'],
  },
};
