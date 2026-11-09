/**
 * OpenRouter live catalog. Only zero-price models are kept; the provider has
 * many paid models and the plugin's purpose is the free subset.
 */

import { SourceError, asArray, isRecord, isZeroPrice, nowIso } from '../util.js';
import { chatModelFromOpenAiLike, evidence, providerRecord } from './shared.js';

export const id = 'openrouter';
export const label = 'OpenRouter';
export const url = 'https://openrouter.ai/api/v1/models';
export const timeoutMs = 15000;

export function normalize(payload, fetchedAt = nowIso()) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new SourceError('BAD_PAYLOAD', 'OpenRouter listing has no data array');
  }
  const models = [];
  for (const raw of payload.data) {
    if (!isRecord(raw)) continue;
    const pricing = isRecord(raw.pricing) ? raw.pricing : {};
    const free = isZeroPrice(pricing.prompt)
      && isZeroPrice(pricing.completion)
      && (pricing.request === undefined || isZeroPrice(pricing.request));
    if (!free) continue;
    const model = chatModelFromOpenAiLike(raw, {
      source: id,
      url,
      fetchedAt,
      freeKind: 'zero_price',
    });
    if (model !== null) models.push(model);
  }
  return {
    providers: [providerRecord({
      key: 'openrouter',
      name: 'OpenRouter',
      routeId: 'openrouter',
      displayName: 'OpenRouter',
      api: 'openai-completions',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      docsURL: 'https://openrouter.ai/models',
      signupURL: 'https://openrouter.ai/keys',
      freeKind: 'zero_price',
      freeNote: 'Zero-price models; an OpenRouter API key and rate limits apply.',
      verifiedAt: null,
      models,
      evidence: [evidence(id, url, 'live', fetchedAt, 'pricing.prompt and pricing.completion are zero')],
      warnings: models.length === 0 ? ['OpenRouter currently lists no zero-price models.'] : [],
      sourceId: id,
    })],
    warnings: models.length === 0 ? ['OpenRouter currently lists no zero-price models.'] : [],
    modelCount: models.length,
  };
}

export async function fetchSource(fetchJson, signal) {
  const payload = await fetchJson(url, { timeoutMs, signal });
  return normalize(payload, nowIso());
}

export const source = { id, label, url, timeoutMs, normalize, fetchSource };
