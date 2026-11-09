/**
 * Vercel AI Gateway live catalog. Free models are the explicit `-free` rows
 * and rows whose input/output price is zero.
 */

import { SourceError, isRecord, isZeroPrice, nowIso } from '../util.js';
import { chatModelFromOpenAiLike, evidence, providerRecord } from './shared.js';

export const id = 'vercel';
export const label = 'Vercel AI Gateway';
export const url = 'https://ai-gateway.vercel.sh/v1/models';
export const timeoutMs = 15000;

export function normalize(payload, fetchedAt = nowIso()) {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new SourceError('BAD_PAYLOAD', 'Vercel listing has no data array');
  }
  const models = [];
  for (const raw of payload.data) {
    if (!isRecord(raw)) continue;
    const pricing = isRecord(raw.pricing) ? raw.pricing : {};
    const free = isZeroPrice(pricing.input)
      && isZeroPrice(pricing.output)
      && (pricing.request === undefined || isZeroPrice(pricing.request));
    if (!free) continue;
    if (typeof raw.type === 'string' && raw.type !== 'language') continue;
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
      key: 'vercel',
      name: 'Vercel AI Gateway',
      routeId: 'vercel',
      displayName: 'Vercel AI Gateway',
      api: 'openai-completions',
      baseURL: 'https://ai-gateway.vercel.sh/v1',
      apiKeyEnv: 'AI_GATEWAY_API_KEY',
      apiKeyEnvAliases: ['VERCEL_AI_GATEWAY_API_KEY'],
      docsURL: 'https://vercel.com/docs/ai-gateway',
      signupURL: 'https://vercel.com/ai-gateway',
      freeKind: 'zero_price',
      freeNote: 'Zero-price models via Vercel AI Gateway; a gateway API key and rate limits apply.',
      verifiedAt: null,
      models,
      evidence: [evidence(id, url, 'live', fetchedAt, 'pricing.input and pricing.output are zero')],
      warnings: models.length === 0 ? ['Vercel AI Gateway currently lists no zero-price models.'] : [],
      sourceId: id,
    })],
    warnings: models.length === 0 ? ['Vercel AI Gateway currently lists no zero-price models.'] : [],
    modelCount: models.length,
  };
}

export async function fetchSource(fetchJson, signal) {
  const payload = await fetchJson(url, { timeoutMs, signal });
  return normalize(payload, nowIso());
}

export const source = { id, label, url, timeoutMs, normalize, fetchSource };
