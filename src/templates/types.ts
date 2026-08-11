import type { ZodType } from 'zod';

export interface TemplateSize {
  width: number;
  height: number;
}

/**
 * A template is a pure function of its fields plus the set of remote images whose
 * bytes actually arrived. `images` declares what to pre-fetch; `html` must render
 * something sensible when a declared URL is missing from `loaded`.
 */
export interface Template<F> {
  name: string;
  size: TemplateSize;
  schema: ZodType<F>;
  images: (fields: F) => string[];
  html: (fields: F, loaded: ReadonlySet<string>) => string;
  /** Fills the preview form and documents the field shape for the consuming site. */
  sample: F;
}

export type AnyTemplate = Template<never>;
