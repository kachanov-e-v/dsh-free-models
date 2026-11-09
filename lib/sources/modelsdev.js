/**
 * models.dev public metadata: provider names, docs, env hints, endpoints, and
 * per-model context/cost. It is the broadest source, but `cost: 0` alone is not
 * proof that access is free, so these records start as `unverified`.
 */

import { SourceError, asArray, isChatModel, isRecord, nowIso, uniqueStrings } from '../util.js';
import { evidence, modelRecord, providerRecord } from './shared.js';

export const id = 'modelsdev';
export const label = 'models.dev';
export const url = 'https://models.dev/api.json';
export const timeoutMs = 25000;
const MAX_MODELS_PER_PROVIDER = 80;

function protocolFor(npm, api) {
  if (typeof npm === 'string') {
    if (npm.includes('anthropic')) return 'anthropic-messages';
    if (npm.includes('google')) return null;
    if (
      npm.includes('openai-compatible')
      || npm.includes('openai')
      || npm.includes('groq')
      || npm.includes('cerebras')
      || npm.includes('mistral')
      || npm.includes('xai')
      || npm.includes('deepseek')
      || npm.includes('moonshot')
      || npm.includes('zhipu')
      || npm.includes('alibaba')
      || npm.includes('vercel')
      || npm.includes('gateway')
    ) return 'openai-completions';
  }
  return typeof api === 'string' && api !== '' ? 'openai-completions' : null;
}

function costIsZero(cost) {
  if (!isRecord(cost)) return false;
  const input = Number(cost.input);
  const output = Number(cost.output);
  return Number.isFinite(input) && input === 0 && Number.isFinite(output) && output === 0;
}

export function normalize(payload, fetchedAt = nowIso()) {
  if (!isRecord(payload)) throw new SourceError('BAD_PAYLOAD', 'models.dev payload is not an object');
  const providers = [];
  let modelCount = 0;
  for (const [providerKey, rawProvider] of Object.entries(payload)) {
    if (!isRecord(rawProvider)) continue;
    const rawModels = isRecord(rawProvider.models) ? Object.values(rawProvider.models) : [];
    if (rawModels.length === 0) continue;
    const models = [];
    let zeroCount = 0;
    for (const raw of rawModels) {
      if (!isRecord(raw) || !isChatModel(raw, raw.modalities?.output)) continue;
      const modelId = typeof raw.id === 'string' && raw.id !== '' ? raw.id : '';
      if (modelId === '') continue;
      const zero = costIsZero(raw.cost);
      if (zero) zeroCount += 1;
      models.push(modelRecord({
        id: modelId,
        name: raw.name,
        contextWindow: raw.limit?.context,
        maxTokens: raw.limit?.output,
        input: raw.modalities?.input,
        reasoning: raw.reasoning === true,
        freeKind: zero ? 'unverified' : 'paid',
        evidence: [evidence(
          id,
          url,
          'catalog',
          fetchedAt,
          zero ? 'models.dev reports zero input/output cost' : 'models.dev reports a paid model',
        )],
      }));
    }
    if (models.length === 0) continue;
    const api = protocolFor(rawProvider.npm, rawProvider.api);
    const baseURL = api !== null && typeof rawProvider.api === 'string' && rawProvider.api !== ''
      ? rawProvider.api
      : null;
    const env = uniqueStrings(asArray(rawProvider.env));
    const displayName = typeof rawProvider.name === 'string' && rawProvider.name !== ''
      ? rawProvider.name
      : providerKey;
    const zeroNote = zeroCount > 0
      ? `models.dev reports zero cost for ${zeroCount} model${zeroCount === 1 ? '' : 's'}; verify access and limits with the provider.`
      : 'models.dev reports metadata for this provider; free-tier availability must be verified.';
    providers.push(providerRecord({
      key: providerKey,
      name: displayName,
      routeId: providerKey,
      displayName,
      api,
      baseURL,
      apiKeyEnv: env[0] ?? null,
      apiKeyEnvAliases: env.slice(1),
      docsURL: typeof rawProvider.doc === 'string' ? rawProvider.doc : null,
      signupURL: null,
      freeKind: 'unverified',
      freeNote: zeroNote,
      verifiedAt: null,
      models: models.slice(0, MAX_MODELS_PER_PROVIDER),
      evidence: [evidence(id, url, 'catalog', fetchedAt, zeroNote)],
      warnings: zeroCount > 0
        ? ['Zero cost in models.dev is metadata, not a verified free tier.']
        : [],
      sourceId: id,
    }));
    modelCount += models.length;
  }
  return {
    providers,
    warnings: providers.length === 0 ? ['models.dev returned no chat models.'] : [],
    modelCount,
  };
}

export async function fetchSource(fetchJson, signal) {
  const payload = await fetchJson(url, { timeoutMs, signal });
  return normalize(payload, nowIso());
}

export const source = { id, label, url, timeoutMs, normalize, fetchSource };
