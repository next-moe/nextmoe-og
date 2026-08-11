import { z } from 'zod';
import {
  OG_SIZE,
  avatar,
  badgeRow,
  clamp,
  escapeHtml,
  metaBar,
  palette,
  spacer,
  textCard,
} from './layout';
import type { Template } from './types';

const TopicSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().max(300).optional(),
  section: z.string().max(40).optional(),
  author: z.string().max(80).optional(),
  authorAvatar: z.url().max(1000).optional(),
  replies: z.number().int().nonnegative().max(999_999).optional(),
  likes: z.number().int().nonnegative().max(999_999).optional(),
});

export type TopicFields = z.infer<typeof TopicSchema>;

const counter = (value: number, unit: string): string =>
  `<div style="display:flex;flex-direction:row;align-items:baseline;margin-left:36px">
     <div style="font-size:34px;font-weight:700;color:${palette.fg}">${value}</div>
     <div style="font-size:24px;color:${palette.muted};margin-left:8px">${unit}</div>
   </div>`;

export const topic: Template<TopicFields> = {
  name: 'topic',
  size: OG_SIZE,
  schema: TopicSchema,
  images: (f) => (f.authorAvatar ? [f.authorAvatar] : []),
  html: (f, loaded) => {
    const face = f.authorAvatar && loaded.has(f.authorAvatar) ? f.authorAvatar : null;
    const byline = `
      <div style="display:flex;flex-direction:row;align-items:center;margin-bottom:28px">
        ${avatar(face, (f.author ?? '?').slice(0, 1))}
        ${
          f.author
            ? `<div style="font-size:30px;color:${palette.fg};margin-left:20px;${clamp(1)}">${escapeHtml(f.author)}</div>`
            : ''
        }
        ${spacer}
        ${f.replies === undefined ? '' : counter(f.replies, '回复')}
        ${f.likes === undefined ? '' : counter(f.likes, '推')}
      </div>`;
    return textCard(`
      ${badgeRow(f.section ? [f.section] : [])}
      <div style="font-size:58px;font-weight:700;line-height:1.26;${clamp(3)}">${escapeHtml(f.title)}</div>
      ${
        f.excerpt
          ? `<div style="margin-top:24px;font-size:28px;line-height:1.5;color:${palette.muted};${clamp(2)}">${escapeHtml(f.excerpt)}</div>`
          : ''
      }
      ${spacer}
      ${byline}
      ${metaBar([])}
    `);
  },
  sample: {
    title: '如何看待近年 Galgame 剧本的叙事实验?',
    excerpt: '从《素晴らしき日々》到《サクラノ詩》,元叙事结构在文字冒险里到底解决了什么问题。',
    section: '游戏讨论',
    author: '鲲',
    replies: 128,
    likes: 64,
  },
};
