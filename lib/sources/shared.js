/**
 * Shared builders for catalog adapters. A source returns provider records in
 * the same shape so the service can merge them without knowing the vendor.
 */

import { isChatModel, isRecord, oneLine, uniqueStrings } from '../util.js';

export function evidence(source, url, kind, fetchedAt, note) {
  return {
    source,
    url,
    kind,
    fetchedAt,
    ...(note === undefined ? {} : { note: oneLine(note, 180) }),
  };
}

export function modelRecord({ id, name, contextWindow, maxTokens, input, reasoning, freeKind, evidence: proof }) {
  return {
    id: String(id),
    name: typeof name === 'string' && name.trim() !== '' ? name.trim() : String(id),
    contextWindow: positiveNumber(contextWindow),
    maxTokens: positiveNumber(maxTokens),
    input: uniqueStrings(Array.isArray(input) && input.length > 0 ? input : ['text']),
    reasoning: typeof reasoning === 'boolean' ? reasoning : null,
    freeKind,
    evidence: Array.isArray(proof) ? proof : [],
    warnings: [],
  };
}

export function providerRecord({
  key,
  name,
  routeId,
  displayName,
  api,
  baseURL,
  apiKeyEnv,
  apiKeyEnvAliases,
  docsURL,
  signupURL,
  freeKind,
  freeNote,
  verifiedAt,
  models,
  evidence: proof,
  warnings,
  sourceId,
  curatedKind = null,
}) {
  return {
    key,
    name: name ?? key,
    displayName: displayName ?? name ?? key,
    routeId: routeId ?? key,
    api: api ?? null,
    baseURL: baseURL ?? null,
    apiKeyEnv: apiKeyEnv ?? null,
    apiKeyEnvAliases: uniqueStrings(apiKeyEnvAliases ?? []),
    docsURL: docsURL ?? null,
    signupURL: signupURL ?? null,
    freeKind,
    curatedKind,
    freeNote: freeNote ?? '',
    verifiedAt: verifiedAt ?? null,
    models: Array.isArray(models) ? models : [],
    evidence: Array.isArray(proof) ? proof : [],
    warnings: uniqueStrings(warnings ?? []),
    sourceIds: sourceId === undefined ? [] : [sourceId],
    configured: false,
  };
}

export function positiveNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

export function chatModelFromOpenAiLike(raw, { source, url, fetchedAt, freeKind }) {
  if (!isRecord(raw)) return null;
  if (!isChatModel(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (id === '') return null;
  return modelRecord({
    id,
    name: raw.name,
    contextWindow: raw.context_length ?? raw.context_window ?? raw.top_provider?.context_length,
    maxTokens: raw.max_completion_tokens ?? raw.top_provider?.max_completion_tokens ?? raw.max_tokens,
    input: raw.architecture?.input_modalities ?? inputFromTags(raw.tags),
    reasoning: raw.reasoning,
    freeKind,
    evidence: [evidence(source, url, 'live', fetchedAt, 'catalog price is zero')],
  });
}

export function inputFromTags(tags) {
  if (!Array.isArray(tags)) return ['text'];
  const input = ['text'];
  if (tags.includes('vision') || tags.includes('image')) input.push('image');
  if (tags.includes('audio')) input.push('audio');
  if (tags.includes('pdf') || tags.includes('file')) input.push('file');
  return input;
}
