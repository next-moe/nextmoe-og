import { work } from './work';
import type { Template } from './types';

/** M2 adds character / label / person / topic / patch / site here; all share `./layout`. */
const registry = new Map<string, Template<never>>([['work', work as unknown as Template<never>]]);

export const getTemplate = (name: string): Template<never> | undefined => registry.get(name);

export const templateNames = (): string[] => [...registry.keys()];
