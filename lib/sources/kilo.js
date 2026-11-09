/**
 * Kilo Gateway live catalog. Kilo uses explicit zero prices for its free
 * variants; a negative or absent price is not treated as free.
 */

import { SourceError, isRecord, isZeroPrice, nowIso } from '../util.js';
import { chatModelFromOpenAiLike, evidence, providerRecord } from './shared.js';

export const id = 'kilo';
export const label = 'Kilo Gateway';
export const url = 'https://ai-gateway.kilo.ai/api/v1/models';
export const timeoutMs = 15000;

export function normalize(payload, fetchedAt = nowIso()) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new SourceError('BAD_PAYLOAD', 'Kilo listing has no data array');
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
      key: 'kilo',
      name: 'Kilo Gateway',
      routeId: 'kilo',
      displayName: 'Kilo Gateway',
      api: 'openai-completions',
      baseURL: 'https://ai-gateway.kilo.ai/api/v1',
      apiKeyEnv: 'KILO_API_KEY',
      docsURL: 'https://kilo.ai',
      signupURL: 'https://app.kilo.ai/',
      freeKind: 'zero_price',
      freeNote: 'Zero-price models via Kilo Gateway; a Kilo API key and rate limits apply.',
      verifiedAt: null,
      models,
      evidence: [evidence(id, url, 'live', fetchedAt, 'pricing.prompt and pricing.completion are zero')],
      warnings: models.length === 0 ? ['Kilo Gateway currently lists no zero-price models.'] : [],
      sourceId: id,
    })],
    warnings: models.length === 0 ? ['Kilo Gateway currently lists no zero-price models.'] : [],
    modelCount: models.length,
  };
}

export async function fetchSource(fetchJson, signal) {
  const payload = await fetchJson(url, { timeoutMs, signal });
  return normalize(payload, nowIso());
}

export const source = { id, label, url, timeoutMs, normalize, fetchSource };
