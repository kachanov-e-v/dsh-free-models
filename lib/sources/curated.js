/**
 * Curated free-tier registry. A record here is a human claim, not a live price
 * lookup, so every entry must carry source URLs and a verification date. Invalid
 * entries are skipped with a warning instead of hiding the rest.
 */

import { readFile } from 'node:fs/promises';
import {
  SourceError,
  asArray,
  isOlderThanDays,
  isRecord,
  isoDate,
  nowIso,
  oneLine,
  safeHttpUrl,
  uniqueStrings,
  validateEnvName,
  validateModelId,
  validateRouteId,
} from '../util.js';
import { evidence, modelRecord, providerRecord } from './shared.js';

export const id = 'curated';
export const label = 'Curated free tiers';
export const url = new URL('../../data/providers.json', import.meta.url);

const FREE_KINDS = new Set(['free_tier', 'trial', 'local']);
const PROTOCOLS = new Set(['openai-completions', 'openai-responses', 'anthropic-messages']);
let cached = null;

function httpUrl(value, allowLocalhost = false) {
  return safeHttpUrl(value, { allowLocalhost }) !== null;
}

function normalizeModel(raw, freeKind, fetchedAt) {
  if (!isRecord(raw)) return null;
  const idError = validateModelId(raw.id);
  if (idError !== null) return null;
  return modelRecord({
    id: raw.id,
    name: raw.name,
    contextWindow: raw.contextWindow,
    maxTokens: raw.maxTokens,
    input: raw.input,
    reasoning: raw.reasoning,
    freeKind,
    evidence: [],
  });
}

export function normalizeCurated(payload, fetchedAt = nowIso()) {
  if (!isRecord(payload) || payload.schemaVersion !== 1 || !Array.isArray(payload.providers)) {
    throw new SourceError('BAD_PAYLOAD', 'curated registry must contain schemaVersion 1 and a providers array');
  }
  const providers = [];
  const warnings = [];
  const seen = new Set();
  for (const [index, raw] of payload.providers.entries()) {
    const where = `providers[${index}]`;
    if (!isRecord(raw)) {
      warnings.push(`${where} is not an object`);
      continue;
    }
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(key)) {
      warnings.push(`${where}.key is invalid`);
      continue;
    }
    if (seen.has(key)) {
      warnings.push(`${where}.key "${key}" is duplicated`);
      continue;
    }
    seen.add(key);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name === '') {
      warnings.push(`${where}.name is empty`);
      continue;
    }
    const freeKind = raw.freeKind;
    if (!FREE_KINDS.has(freeKind)) {
      warnings.push(`${where}.freeKind must be free_tier, trial or local`);
      continue;
    }
    const routeId = typeof raw.routeId === 'string' ? raw.routeId : key;
    const routeError = validateRouteId(routeId);
    if (routeError !== null) {
      warnings.push(`${where}.routeId: ${routeError}`);
      continue;
    }
    const docsURL = typeof raw.docsURL === 'string' && httpUrl(raw.docsURL) ? raw.docsURL : null;
    if (docsURL === null) warnings.push(`${where}.docsURL is missing or not https`);
    const sources = uniqueStrings(asArray(raw.sources).filter((value) => typeof value === 'string' && httpUrl(value)));
    if (sources.length === 0) {
      warnings.push(`${where}.sources must list at least one https source`);
      continue;
    }
    const verifiedAt = isoDate(raw.verifiedAt);
    if (verifiedAt === null) warnings.push(`${where}.verifiedAt is missing or invalid`);
    if (verifiedAt !== null && isOlderThanDays(verifiedAt, 180)) {
      warnings.push(`${where}.verifiedAt is older than 180 days`);
    }
    const api = raw.api === null || raw.api === undefined ? null : raw.api;
    if (api !== null && !PROTOCOLS.has(api)) {
      warnings.push(`${where}.api is not a supported protocol`);
      continue;
    }
    const baseURL = typeof raw.baseURL === 'string' ? raw.baseURL : null;
    if (baseURL !== null && !httpUrl(baseURL, freeKind === 'local')) {
      warnings.push(`${where}.baseURL must be https (http is allowed only for local providers)`);
      continue;
    }
    const apiKeyEnv = typeof raw.apiKeyEnv === 'string' && raw.apiKeyEnv !== '' ? raw.apiKeyEnv : null;
    if (apiKeyEnv !== null && validateEnvName(apiKeyEnv) !== null) {
      warnings.push(`${where}.apiKeyEnv is not an environment variable name`);
      continue;
    }
    const aliases = uniqueStrings(asArray(raw.apiKeyEnvAliases));
    const badAlias = aliases.find((alias) => validateEnvName(alias) !== null);
    if (badAlias !== undefined) {
      warnings.push(`${where}.apiKeyEnvAliases contains an invalid name`);
      continue;
    }
    const models = asArray(raw.models)
      .map((model) => normalizeModel(model, freeKind, verifiedAt ?? fetchedAt))
      .filter(Boolean);
    const note = typeof raw.freeNote === 'string' ? oneLine(raw.freeNote, 400) : '';
    providers.push(providerRecord({
      key,
      name,
      routeId,
      displayName: name,
      api,
      baseURL,
      apiKeyEnv,
      apiKeyEnvAliases: aliases,
      docsURL,
      signupURL: typeof raw.signupURL === 'string' && httpUrl(raw.signupURL) ? raw.signupURL : null,
      freeKind,
      freeNote: note,
      verifiedAt,
      models,
      evidence: sources.map((source) => evidence(id, source, 'documented', verifiedAt ?? fetchedAt, note)),
      warnings: [],
      sourceId: id,
      curatedKind: freeKind,
    }));
  }
  return { providers, warnings, modelCount: providers.reduce((sum, provider) => sum + provider.models.length, 0) };
}

export async function loadCurated() {
  if (cached !== null) return cached;
  let text;
  try {
    text = await readFile(url, 'utf8');
  } catch (error) {
    throw new SourceError('CURATED_MISSING', 'could not read data/providers.json', { cause: error });
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new SourceError('BAD_PAYLOAD', 'data/providers.json is not valid JSON');
  }
  cached = normalizeCurated(payload, nowIso());
  return cached;
}

export async function fetchSource() {
  return loadCurated();
}

export const source = { id, label, url: String(url), timeoutMs: 0, normalize: normalizeCurated, fetchSource };
