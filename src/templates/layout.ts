import { config } from '../config';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const palette = {
  bg: '#0a0a0a',
  surface: '#18181b',
  surfaceAlt: '#27272a',
  line: '#3f3f46',
  fg: '#ecedee',
  muted: '#a1a1aa',
  primary: '#2881fb',
  secondary: '#e315b2',
  warning: '#b67700',
  success: '#299e62',
} as const;

export const accents = [palette.primary, palette.secondary, palette.warning, palette.success];

export const fontStack = {
  jp: "'NextMoe Sans','NextMoe JP','NextMoe SC'",
  sc: "'NextMoe Sans','NextMoe SC','NextMoe JP'",
  latin: "'NextMoe Sans','NextMoe SC','NextMoe JP'",
} as const;

export const escapeHtml = (raw: string): string =>
  raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Multi-line truncation. `display: -webkit-box` throws InvalidArg in takumi; bare `line-clamp` is the one that works. */
export const clamp = (lines: number): string =>
  `line-clamp:${lines};overflow:hidden;text-overflow:ellipsis`;

export const clampOne = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

export const badge = (text: string, accent: string): string =>
  `<div style="display:flex;font-size:22px;font-weight:700;color:${accent};border:2px solid ${accent};border-radius:9999px;padding:6px 18px;margin-right:12px">${escapeHtml(text)}</div>`;

export const badgeRow = (items: string[]): string =>
  items.length === 0
    ? ''
    : `<div style="display:flex;flex-direction:row;margin-bottom:24px">${items
        .slice(0, 4)
        .map((text, i) => badge(text, accents[i % accents.length] as string))
        .join('')}</div>`;

/** Left visual column: the cover when its bytes arrived, a lettermark block when they did not. */
export const visualColumn = (src: string | null, fallbackLetter: string, width = 440): string =>
  src
    ? `<img src="${escapeHtml(src)}" style="width:${width}px;height:${OG_SIZE.height}px;object-fit:cover" />`
    : `<div style="width:${width}px;height:${OG_SIZE.height}px;background-color:${palette.surface};display:flex;align-items:center;justify-content:center;font-size:140px;font-weight:700;color:${palette.line}">${escapeHtml(fallbackLetter)}</div>`;

export const metaBar = (parts: string[]): string =>
  `<div style="height:2px;background-color:${palette.line};margin-bottom:24px"></div>
   <div style="display:flex;flex-direction:row;align-items:center;font-size:26px;color:${palette.muted};font-family:${fontStack.jp}">
     ${parts
       .filter(Boolean)
       .map((p) => escapeHtml(p))
       .join(`<div style="margin:0 14px">·</div>`)}
     <div style="flex:1"></div>
     <div style="color:${palette.primary};font-weight:700;font-family:${fontStack.latin}">${escapeHtml(config.OG_BRAND)}</div>
   </div>`;

/** Left visual + right text column. The skeleton every entity template shares. */
export const splitCard = (visual: string, body: string): string =>
  `<div style="width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;background-color:${palette.bg};color:${palette.fg};display:flex;flex-direction:row;font-family:${fontStack.sc}">
     ${visual}
     <div style="flex:1;display:flex;flex-direction:column;padding:56px 56px 44px 56px">${body}</div>
   </div>`;

/** Full-bleed image with an information bar pinned to the bottom. The other shared skeleton. */
export const bannerCard = (background: string | null, body: string): string =>
  `<div style="width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;background-color:${palette.bg};color:${palette.fg};display:flex;flex-direction:column;font-family:${fontStack.sc}">
     ${
       background
         ? `<img src="${escapeHtml(background)}" style="width:${OG_SIZE.width}px;height:340px;object-fit:cover" />`
         : `<div style="width:${OG_SIZE.width}px;height:340px;background-color:${palette.surface}"></div>`
     }
     <div style="flex:1;display:flex;flex-direction:column;padding:44px 56px">${body}</div>
   </div>`;

export const spacer = '<div style="flex:1"></div>';
