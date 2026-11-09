import * as curated from './curated.js';
import * as kilo from './kilo.js';
import * as modelsdev from './modelsdev.js';
import * as openrouter from './openrouter.js';
import * as vercel from './vercel.js';

export const SOURCES = [curated, kilo, modelsdev, openrouter, vercel].map((module) => module.source);

export const SOURCE_IDS = SOURCES.map((source) => source.id);

export function sourceById(id) {
  return SOURCES.find((source) => source.id === id);
}
