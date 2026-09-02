import { z } from 'zod';
import {
  OG_SIZE,
  SMALL_WEIGHT,
  avatar,
  badgeRow,
  band,
  clamp,
  clampOne,
  escapeHtml,
  metric,
  metricRow,
  palette,
  textCard,
  wordmark,
} from './layout';
import type { Template } from './types';

const TopicSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().max(300).optional(),
  section: z.string().max(40).optional(),
  author: z.string().max(80).optional(),
  authorAvatar: z.url().max(1000).optional(),
  views: z.number().int().nonnegative().max(99_999_999).optional(),
  replies: z.number().int().nonnegative().max(999_999).optional(),
  likes: z.number().int().nonnegative().max(999_999).optional(),
});

export type TopicFields = z.infer<typeof TopicSchema>;

export const topic: Template<TopicFields> = {
  name: 'topic',
  size: OG_SIZE,
  schema: TopicSchema,
  images: (f) => (f.authorAvatar ? [f.authorAvatar] : []),
  html: (f, loaded, brand) => {
    const face = f.authorAvatar && loaded.has(f.authorAvatar) ? f.authorAvatar : null;
    const shown = [
      f.views === undefined ? '' : metric(f.views, '浏览'),
      f.replies === undefined ? '' : metric(f.replies, '回复'),
      f.likes === undefined ? '' : metric(f.likes, '推'),
    ].filter(Boolean);
    const counters = metricRow(shown);

    // max-width, not flex shrink: an 80-character author name pushed the counters off the band,
    // and letting the name box shrink instead clipped its glyphs the way the body column did.
    const byline = `<div style="display:flex;flex-direction:row;align-items:center;gap:26px">
      <div style="display:flex;flex-direction:row;align-items:center">
        ${avatar(face, (f.author ?? '?').slice(0, 1))}
        ${
          f.author
            ? `<div style="display:flex;max-width:${300 - shown.length * 60}px;font-size:29px;font-weight:600;color:${palette.fg};margin-left:20px;${clampOne}">${escapeHtml(f.author)}</div>`
            : ''
        }
      </div>
      ${counters ? `<div style="width:2px;height:44px;background-color:${palette.line}"></div>${counters}` : ''}
    </div>`;

    return textCard(
      `
      ${badgeRow(f.section ? [f.section] : [], 'accent')}
      <div style="font-size:60px;font-weight:800;line-height:1.3;${clamp(3)}">${escapeHtml(f.title)}</div>
      ${
        f.excerpt
          ? `<div style="margin-top:26px;font-size:29px;font-weight:${SMALL_WEIGHT};line-height:1.5;color:${palette.muted};${clamp(2)}">${escapeHtml(f.excerpt)}</div>`
          : ''
      }
    `,
      band(byline, wordmark(brand)),
    );
  },
  sample: {
    title: '如何看待近年 Galgame 剧本的叙事实验?',
    excerpt: '从《素晴らしき日々》到《サクラノ詩》,元叙事结构在文字冒险里到底解决了什么问题。',
    section: '游戏讨论',
    author: '鲲',
    views: 12480,
    replies: 128,
    likes: 64,
  },
};
