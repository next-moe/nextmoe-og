import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { Renderer } from 'takumi-js/node';
import { config } from '../config';

interface FontFace {
  file: string;
  family: string;
}

/**
 * One file per family. These are variable-weight fonts, so a single registration at
 * weight 400 still serves font-weight: 700 through the wght axis — do not add a second
 * file per weight.
 */
export const faces: FontFace[] = [
  { file: 'NotoSans[wdth,wght].ttf', family: 'NextMoe Sans' },
  { file: 'NotoSansJP[wght].ttf', family: 'NextMoe JP' },
  { file: 'NotoSansSC[wght].ttf', family: 'NextMoe SC' },
];

export const fontDir = (): string =>
  isAbsolute(config.FONT_DIR) ? config.FONT_DIR : join(process.cwd(), config.FONT_DIR);

export const registerFonts = async (renderer: Renderer): Promise<number> => {
  let bytes = 0;
  for (const face of faces) {
    const path = join(fontDir(), face.file);
    const data = await readFile(path).catch(() => {
      throw new Error(`missing font ${path} — run \`pnpm fonts\``);
    });
    bytes += data.byteLength;
    await renderer.registerFont({ data, name: face.family, weight: 400 });
  }
  return bytes;
};
