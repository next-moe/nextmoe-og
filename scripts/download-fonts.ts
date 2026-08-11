import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '..', 'assets', 'fonts');

const GOOGLE_FONTS_RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

interface FontAsset {
  file: string;
  url: string;
}

const assets: FontAsset[] = [
  {
    file: 'NotoSans[wdth,wght].ttf',
    url: `${GOOGLE_FONTS_RAW}/notosans/NotoSans%5Bwdth,wght%5D.ttf`,
  },
  {
    file: 'NotoSansSC[wght].ttf',
    url: `${GOOGLE_FONTS_RAW}/notosanssc/NotoSansSC%5Bwght%5D.ttf`,
  },
  {
    file: 'NotoSansJP[wght].ttf',
    url: `${GOOGLE_FONTS_RAW}/notosansjp/NotoSansJP%5Bwght%5D.ttf`,
  },
];

const exists = async (path: string): Promise<boolean> => {
  const info = await stat(path).catch(() => null);
  return info !== null && info.size > 0;
};

const download = async (asset: FontAsset): Promise<void> => {
  const target = join(fontsDir, asset.file);
  if (await exists(target)) {
    console.log(`skip  ${asset.file}`);
    return;
  }
  const res = await fetch(asset.url);
  if (!res.ok || !res.body) throw new Error(`${asset.url} -> HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  const info = await stat(target);
  console.log(`fetch ${asset.file} (${(info.size / 1024 / 1024).toFixed(1)} MiB)`);
};

const main = async (): Promise<void> => {
  await mkdir(fontsDir, { recursive: true });
  for (const asset of assets) await download(asset);
};

await main();
