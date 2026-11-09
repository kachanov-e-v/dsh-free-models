/**
 * Pure catalog normalization: merge provider records from independent sources,
 * mark the strongest free evidence, and keep only models the UI can present.
 */

import { dedupeBy, isRecord, oneLine, uniqueStrings } from './util.js';

export const FREE_KIND_RANK = {
  zero_price: 5,
  free_tier: 4,
  trial: 3,
  local: 2,
  unverified: 1,
};

export const FREE_KIND_LABEL = {
  zero_price: 'zero price',
  free_tier: 'free tier',
  trial: 'trial credits',
  local: 'local',
  unverified: 'unverified',
};

function betterKind(left, right) {
  const a = FREE_KIND_RANK[left] ?? 0;
  const b = FREE_KIND_RANK[right] ?? 0;
  return b > a ? right : left;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function mergeEvidence(...lists) {
  const flat = lists.flatMap((list) => (Array.isArray(list) ? list : []));
  return dedupeBy(
    flat.filter((item) => isRecord(item) && typeof item.source === 'string' && typeof item.url === 'string'),
    (item) => `${item.source}|${item.url}|${item.kind ?? ''}|${item.fetchedAt ?? ''}`,
  );
}

function mergeModel(existing, incoming) {
  if (existing === undefined) return { ...incoming };
  const zero = existing.freeKind === 'zero_price' || incoming.freeKind === 'zero_price'
    ? 'zero_price'
    : betterKind(existing.freeKind, incoming.freeKind);
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    name: firstNonEmpty(incoming.name, existing.name) ?? existing.id,
    contextWindow: incoming.contextWindow ?? existing.contextWindow ?? null,
    maxTokens: incoming.maxTokens ?? existing.maxTokens ?? null,
    input: uniqueStrings([...(existing.input ?? []), ...(incoming.input ?? [])]),
    reasoning: incoming.reasoning ?? existing.reasoning ?? null,
    freeKind: zero,
    evidence: mergeEvidence(existing.evidence, incoming.evidence),
    warnings: uniqueStrings([...(existing.warnings ?? []), ...(incoming.warnings ?? [])]),
  };
}

function mergeProvider(existing, incoming) {
  const models = new Map();
  for (const model of existing.models ?? []) {
    const key = typeof model?.id === 'string' ? model.id : '';
    if (key !== '') models.set(key, model);
  }
  for (const model of incoming.models ?? []) {
    const key = typeof model?.id === 'string' ? model.id : '';
    if (key === '') continue;
    models.set(key, mergeModel(models.get(key), model));
  }
  const freeKind = betterKind(existing.freeKind, incoming.freeKind);
  return {
    ...existing,
    ...incoming,
    key: existing.key,
    name: firstNonEmpty(existing.name, incoming.name) ?? existing.key,
    displayName: firstNonEmpty(existing.displayName, incoming.displayName, existing.name, incoming.name) ?? existing.key,
    routeId: firstNonEmpty(existing.routeId, incoming.routeId) ?? existing.key,
    api: firstNonEmpty(existing.api, incoming.api),
    baseURL: firstNonEmpty(existing.baseURL, incoming.baseURL),
    apiKeyEnv: firstNonEmpty(existing.apiKeyEnv, incoming.apiKeyEnv),
    apiKeyEnvAliases: uniqueStrings([...(existing.apiKeyEnvAliases ?? []), ...(incoming.apiKeyEnvAliases ?? [])]),
    docsURL: firstNonEmpty(existing.docsURL, incoming.docsURL),
    signupURL: firstNonEmpty(existing.signupURL, incoming.signupURL),
    freeKind,
    curatedKind: existing.curatedKind ?? incoming.curatedKind ?? null,
    freeNote: incoming.freeKind === freeKind
      ? firstNonEmpty(incoming.freeNote, existing.freeNote)
      : firstNonEmpty(existing.freeNote, incoming.freeNote),
    verifiedAt: existing.verifiedAt ?? incoming.verifiedAt ?? null,
    evidence: mergeEvidence(existing.evidence, incoming.evidence),
    models: [...models.values()],
    warnings: uniqueStrings([...(existing.warnings ?? []), ...(incoming.warnings ?? [])]),
    sourceIds: uniqueStrings([...(existing.sourceIds ?? []), ...(incoming.sourceIds ?? [])]),
  };
}

/**
 * Merge records from sources in priority order. Later sources fill gaps; the
 * first non-empty value for route facts and human notes wins.
 */
export function mergeProviderRecords(records, { maxModelsPerProvider = 200 } = {}) {
  const providers = new Map();
  for (const record of records) {
    if (!isRecord(record) || typeof record.key !== 'string' || record.key === '') continue;
    const normalized = {
      ...record,
      key: record.key,
      models: Array.isArray(record.models) ? record.models.slice(0, maxModelsPerProvider) : [],
    };
    providers.set(record.key, providers.has(record.key)
      ? mergeProvider(providers.get(record.key), normalized)
      : normalized);
  }
  return [...providers.values()].map((provider) => ({
    ...provider,
    models: dedupeBy(
      provider.models
        .filter((model) => isRecord(model) && typeof model.id === 'string' && model.id !== '')
        .map((model) => ({
          ...model,
          name: firstNonEmpty(model.name, model.id) ?? model.id,
          freeKind: model.freeKind ?? provider.freeKind ?? 'unverified',
        })),
      (model) => model.id,
    ),
  }));
}

function strongestModelKind(provider) {
  let kind = provider.freeKind ?? 'unverified';
  for (const model of provider.models ?? []) {
    kind = betterKind(kind, model.freeKind ?? 'unverified');
  }
  return kind;
}

/**
 * Final provider filter and model labeling.
 *
 * - A provider with live zero-price models is shown as zero_price and keeps
 *   only those models.
 * - A curated free-tier provider keeps its whole known chat catalog, labeled
 *   free_tier, because the free quota applies to the provider, not one model.
 * - A models.dev-only zero-cost provider is shown only when includeUnverified.
 */
export function finalizeProviders(providers, {
  includeUnverified = false,
  includeTrialCredits = false,
  maxModelsPerProvider = 50,
} = {}) {
  const output = [];
  for (const provider of providers) {
    const hasZeroModel = (provider.models ?? []).some((model) => model.freeKind === 'zero_price');
    const curatedKind = provider.curatedKind ?? null;
    const kind = hasZeroModel ? 'zero_price' : strongerKind(provider, curatedKind);
    if (kind === 'unverified' && !includeUnverified) continue;
    if (kind === 'trial' && !includeTrialCredits && curatedKind !== 'free_tier') continue;

    let models = provider.models ?? [];
    if (kind === 'zero_price') {
      models = models.filter((model) => model.freeKind === 'zero_price');
    } else if (kind === 'free_tier') {
      models = models.map((model) => ({
        ...model,
        freeKind: model.freeKind === 'zero_price' ? 'zero_price' : 'free_tier',
      }));
    } else if (kind === 'unverified') {
      models = models.filter((model) => model.freeKind === 'unverified' || model.freeKind === 'zero_price');
    }

    models = sortModels(models).slice(0, maxModelsPerProvider);
    if (kind === 'free_tier' && models.length === 0) {
      // A verified free tier with no published model rows is still useful: the
      // UI links to the provider's own catalog instead of inventing ids.
    }
    const evidence = mergeEvidence(provider.evidence);
    const addable = provider.addable === true
      || provider.installedCatalog === true
      || (provider.api !== null && provider.baseURL !== null);
    output.push({
      ...provider,
      freeKind: kind,
      models,
      evidence,
      addable,
      addBlockReason: addable ? null : 'Protocol or endpoint is unknown; add this provider manually.',
      sourceIds: uniqueStrings(provider.sourceIds ?? []),
      warnings: uniqueStrings(provider.warnings ?? []),
    });
  }
  return sortProviders(output);
}

function strongerKind(provider, curatedKind) {
  let kind = provider.freeKind ?? 'unverified';
  if (curatedKind !== undefined && curatedKind !== null) kind = betterKind(kind, curatedKind);
  return kind;
}

export function sortModels(models) {
  return [...models].sort((left, right) => {
    const context = (right.contextWindow ?? 0) - (left.contextWindow ?? 0);
    if (context !== 0) return context;
    return String(left.id).localeCompare(String(right.id));
  });
}

export function sortProviders(providers) {
  const rank = { zero_price: 0, free_tier: 1, trial: 2, local: 3, unverified: 4 };
  return [...providers].sort((left, right) => {
    const leftRank = rank[left.freeKind] ?? 9;
    const rightRank = rank[right.freeKind] ?? 9;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (Boolean(left.configured) !== Boolean(right.configured)) return left.configured ? -1 : 1;
    const models = (right.models?.length ?? 0) - (left.models?.length ?? 0);
    if (models !== 0) return models;
    return String(left.displayName ?? left.key).localeCompare(String(right.displayName ?? right.key));
  });
}

export function countCatalog(providers) {
  const byKind = {};
  let models = 0;
  for (const provider of providers) {
    byKind[provider.freeKind] = (byKind[provider.freeKind] ?? 0) + 1;
    models += provider.models?.length ?? 0;
  }
  return { providers: providers.length, models, byKind };
}

export function providerSummary(provider) {
  return {
    key: provider.key,
    name: provider.displayName ?? provider.name,
    kind: provider.freeKind,
    models: provider.models?.length ?? 0,
    note: oneLine(provider.freeNote ?? '', 160),
  };
}
