import { character } from './character';
import { label } from './label';
import { patch } from './patch';
import { person } from './person';
import { site } from './site';
import { topic } from './topic';
import { work } from './work';
import type { Template } from './types';

const anyTemplate = (t: Template<never> | unknown): Template<never> => t as Template<never>;

const registry = new Map<string, Template<never>>(
  [work, character, label, person, topic, patch, site].map((t) => [t.name, anyTemplate(t)]),
);

export const getTemplate = (name: string): Template<never> | undefined => registry.get(name);

export const templateNames = (): string[] => [...registry.keys()];

export const allTemplates = (): Template<never>[] => [...registry.values()];
