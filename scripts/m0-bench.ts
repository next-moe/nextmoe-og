import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const t0 = performance.now();

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fontsDir = join(root, 'assets', 'fonts');
const samplesDir = join(root, 'samples');

const { Renderer } = await import('takumi-js/node');
const { render } = await import('takumi-js');
const { prepareImages } = await import('takumi-js/helpers');
const tImported = performance.now();

const renderer = new Renderer();

const faces = [
  { file: 'NotoSans[wdth,wght].ttf', name: 'NextMoe Sans' },
  { file: 'NotoSansJP[wght].ttf', name: 'NextMoe JP' },
  { file: 'NotoSansSC[wght].ttf', name: 'NextMoe SC' },
];

let fontBytes = 0;
for (const face of faces) {
  const data = await readFile(join(fontsDir, face.file));
  fontBytes += data.byteLength;
  await renderer.registerFont({ data, name: face.name, weight: 400 });
}
const tReady = performance.now();

const C = {
  bg: '#0a0a0a',
  surface: '#18181b',
  line: '#3f3f46',
  fg: '#ecedee',
  muted: '#a1a1aa',
  primary: '#2881fb',
  secondary: '#e315b2',
  warning: '#b67700',
};

const JP = "'NextMoe Sans','NextMoe JP','NextMoe SC'";
const SC = "'NextMoe Sans','NextMoe SC','NextMoe JP'";

const LONG_TITLE =
  '素晴らしき日々〜不連続存在〜 終ノ空 リメイク 完全版 ディレクターズカット 特別限定生産版 追加シナリオ全部入り';

const dirtySample = `<div style="width:1200px;height:630px;background-color:${C.bg};color:${C.fg};display:flex;flex-direction:column;padding:48px;font-family:${JP}">
  <div style="font-size:24px;color:${C.primary};font-weight:700;margin-bottom:24px">M0 — glyph coverage / dirty data</div>

  <div style="font-size:44px;font-weight:700;font-family:${JP}">白昼夢の青写真</div>
  <div style="font-size:44px;font-weight:700;font-family:${JP}">サクラノ詩 −櫻ノ森ノ上ヲ舞フ−</div>
  <div style="font-size:36px;font-family:${JP};color:${C.muted}">終ノ空 / 素晴らしき日々〜不連続存在〜</div>

  <div style="display:flex;flex-direction:row;margin-top:16px">
    <div style="font-size:36px;font-family:${SC};margin-right:32px">简体：说谎的少女与坏掉的机器</div>
    <div style="font-size:36px;font-family:${JP}">繁異體：説謊的少女與壞掉的機器</div>
  </div>

  <div style="font-size:34px;margin-top:12px">Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ ♥ ★ ☆ ♪ ※ → （全角）「引用」【标签】〜〜</div>

  <div style="margin-top:20px;font-size:34px;color:${C.muted};line-clamp:2;overflow:hidden;text-overflow:ellipsis;font-family:${JP}">
    line-clamp 2: ${LONG_TITLE}
  </div>

  <div style="margin-top:12px;font-size:34px;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:${JP}">
    nowrap ellipsis: ${LONG_TITLE}
  </div>
</div>`;

interface WorkFields {
  title: string;
  originalName: string;
  cover: string | null;
  label: string;
  releaseDate: string;
  badges: string[];
}

const badge = (text: string, color: string): string =>
  `<div style="display:flex;font-size:22px;font-weight:700;color:${color};border:2px solid ${color};border-radius:9999px;padding:6px 18px;margin-right:12px">${text}</div>`;

const workSample = (
  f: WorkFields,
): string => `<div style="width:1200px;height:630px;background-color:${C.bg};color:${C.fg};display:flex;flex-direction:row;font-family:${SC}">
  ${
    f.cover
      ? `<img src="${f.cover}" style="width:440px;height:630px;object-fit:cover" />`
      : `<div style="width:440px;height:630px;background-color:${C.surface};display:flex;align-items:center;justify-content:center;font-size:120px;color:${C.line};font-weight:700">N</div>`
  }
  <div style="flex:1;display:flex;flex-direction:column;padding:56px 56px 44px 56px">
    <div style="display:flex;flex-direction:row;margin-bottom:28px">${f.badges
      .map((b, i) => badge(b, [C.primary, C.secondary, C.warning][i % 3] as string))
      .join('')}</div>
    <div style="font-size:56px;font-weight:700;line-height:1.24;line-clamp:2;overflow:hidden;text-overflow:ellipsis">${f.title}</div>
    <div style="margin-top:16px;font-size:30px;color:${C.muted};font-family:${JP};line-clamp:2;overflow:hidden;text-overflow:ellipsis">${f.originalName}</div>
    <div style="flex:1"></div>
    <div style="height:2px;background-color:${C.line};margin-bottom:24px"></div>
    <div style="display:flex;flex-direction:row;align-items:center;font-size:26px;color:${C.muted}">
      <div style="font-family:${JP}">${f.label}</div>
      <div style="margin:0 14px">·</div>
      <div>${f.releaseDate}</div>
      <div style="flex:1"></div>
      <div style="color:${C.primary};font-weight:700">nextmoe</div>
    </div>
  </div>
</div>`;

const REMOTE_COVER = 'https://picsum.photos/seed/nextmoe-og/560/720';
const BROKEN_COVER = 'https://picsum.photos.invalid/seed/nope/560/720';

const fields: WorkFields = {
  title: '素晴らしき日々〜不連続存在〜',
  originalName: '素晴らしき日々 〜不連続存在〜 / Subarashiki Hibi ~Furenzoku Sonzai~',
  cover: REMOTE_COVER,
  label: 'ケロQ',
  releaseDate: '2010-03-26',
  badges: ['ADV', '18+', 'PC'],
};

const draw = (html: string): Promise<Buffer<ArrayBuffer> | Uint8Array<ArrayBuffer>> =>
  render(html, { renderer, width: 1200, height: 630, format: 'png', emoji: 'from-font' });

await mkdir(samplesDir, { recursive: true });

const tDirty0 = performance.now();
const dirtyPng = await draw(dirtySample);
const tDirty1 = performance.now();
await writeFile(join(samplesDir, 'm0-dirty-data.png'), dirtyPng);

const tWork0 = performance.now();
const workPng = await draw(workSample(fields));
const tWork1 = performance.now();
await writeFile(join(samplesDir, 'm0-work-remote-cover.png'), workPng);

const probeBroken = async (): Promise<string> => {
  try {
    await draw(workSample({ ...fields, cover: BROKEN_COVER }));
    return 'render succeeded (image silently dropped)';
  } catch (e) {
    return `render THREW: ${(e as Error).message}`;
  }
};
const brokenBehaviour = await probeBroken();

const probeDegraded = async (): Promise<string> => {
  const html = workSample({ ...fields, cover: BROKEN_COVER });
  const { fromHtml } = await import('takumi-js/helpers/html');
  const parsed = fromHtml(html);
  const node = 'node' in parsed ? parsed.node : parsed;
  const images = await prepareImages({ node, throwOnError: false, timeout: 3_000 });
  const png = await renderer.render(node as never, {
    width: 1200,
    height: 630,
    format: 'png',
    images: images.map((i) => ({ src: i.src, data: i.data })),
  });
  await writeFile(join(samplesDir, 'm0-work-cover-failed.png'), png);
  return `prepareImages({throwOnError:false}) -> ${images.length} image(s) survived, render ok (${png.length} B)`;
};
const degradedBehaviour = await probeDegraded().catch(
  (e) => `degraded path FAILED: ${(e as Error).message}`,
);

const noCoverPng = await draw(workSample({ ...fields, cover: null }));
await writeFile(join(samplesDir, 'm0-work-text-only.png'), noCoverPng);

const N = 10;
const warm = workSample({ ...fields, cover: null });
await draw(warm);
const tLoop0 = performance.now();
for (let i = 0; i < N; i += 1) await draw(warm);
const tLoop1 = performance.now();

const cachedCover = await fetch(REMOTE_COVER)
  .then((r) => r.arrayBuffer())
  .catch(() => null);
let perRenderWithCover = NaN;
if (cachedCover) {
  const html = workSample(fields);
  const images = [{ src: REMOTE_COVER, data: cachedCover }];
  await render(html, {
    renderer,
    width: 1200,
    height: 630,
    format: 'png',
    images,
    emoji: 'from-font',
  });
  const s = performance.now();
  for (let i = 0; i < N; i += 1)
    await render(html, {
      renderer,
      width: 1200,
      height: 630,
      format: 'png',
      images,
      emoji: 'from-font',
    });
  perRenderWithCover = (performance.now() - s) / N;
}

const webp = await render(workSample({ ...fields, cover: null }), {
  renderer,
  width: 1200,
  height: 630,
  format: 'webp',
  quality: 88,
  emoji: 'from-font',
});

const mib = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MiB`;
const ms = (n: number): string => `${n.toFixed(1)} ms`;
const rss = process.memoryUsage();

console.log(`
=== nextmoe-og M0 ===
font bytes registered      ${mib(fontBytes)} (${faces.length} files)
import takumi (native)     ${ms(tImported - t0)}
renderer + registerFont    ${ms(tReady - tImported)}
COLD START total           ${ms(tReady - t0)}

first render (dirty)       ${ms(tDirty1 - tDirty0)}
first render (work+remote) ${ms(tWork1 - tWork0)}
warm render x${N} avg       ${ms((tLoop1 - tLoop0) / N)}   (text-only card)
warm render x${N} avg       ${ms(perRenderWithCover)}   (with pre-fetched cover)

png bytes (work card)      ${workPng.length} B
webp q88 bytes             ${webp.length} B

RSS                        ${mib(rss.rss)}
heapUsed                   ${mib(rss.heapUsed)}
external                   ${mib(rss.external)}

remote image, bad host     ${brokenBehaviour}
remote image, degraded     ${degradedBehaviour}
`);
