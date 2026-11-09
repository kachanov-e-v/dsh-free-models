/**
 * Catalog service: runs the configured sources, keeps their last good answer,
 * and produces the normalized snapshot shared by the UI and the agent tools.
 */

import {
  countCatalog,
  finalizeProviders,
  mergeProviderRecords,
  sortModels,
} from './normalize.js';
import { SOURCES } from './sources/index.js';
import {
  SourceError,
  clampInt,
  errorInfo,
  fetchJson as defaultFetchJson,
  nowIso,
  oneLine,
  safeHttpUrl,
  uniqueStrings,
} from './util.js';

function normalizeSourceConfig(value, availableIds) {
  const allowed = new Set(availableIds);
  if (!Array.isArray(value)) return [...availableIds];
  const selected = uniqueStrings(value).filter((id) => allowed.has(id));
  return selected.length > 0 ? selected : [...availableIds];
}

function sameUrl(left, right) {
  const a = safeHttpUrl(left);
  const b = safeHttpUrl(right);
  if (a === null || b === null) return false;
  const normalize = (url) => `${url.host}${url.pathname.replace(/\/+$/u, '')}`;
  return normalize(a) === normalize(b);
}

function installedFor(provider, installed) {
  return installed.find((entry) => entry.provider === provider.key)
    ?? installed.find((entry) => entry.provider === provider.routeId)
    ?? null;
}

function activeFor(provider, active) {
  return active.find((entry) => entry.routeId === provider.routeId)
    ?? active.find((entry) => provider.baseURL !== null && sameUrl(entry.baseURL, provider.baseURL))
    ?? null;
}

function profileFor(provider, dshState) {
  const entries = Object.entries(dshState?.settings?.providers ?? {});
  const envs = new Set([
    provider.apiKeyEnv,
    ...(provider.apiKeyEnvAliases ?? []),
  ].filter((value) => typeof value === 'string' && value !== ''));
  return entries.find(([routeId, profile]) => {
    if (routeId === provider.routeId || routeId === provider.key) return true;
    return profile !== null
      && typeof profile === 'object'
      && typeof profile.apiKeyEnv === 'string'
      && envs.has(profile.apiKeyEnv);
  }) ?? null;
}

function enrichWithDsh(providers, dshState) {
  const installed = Array.isArray(dshState?.installed) ? dshState.installed : [];
  const active = Array.isArray(dshState?.active) ? dshState.active : [];
  return providers.map((provider) => {
    const installedEntry = installedFor(provider, installed);
    const activeEntry = activeFor(provider, active);
    const profileEntry = profileFor(provider, dshState);
    const installedCatalog = installedEntry !== null && installedEntry.declared === false;
    const routeId = installedEntry?.provider ?? provider.routeId;
    const installedName = installedEntry?.displayName;
    const displayName = typeof installedName === 'string' && installedName !== '' && installedName !== routeId
      ? installedName
      : provider.displayName;
    const api = provider.api;
    const baseURL = provider.baseURL ?? installedEntry?.defaultBaseURL ?? null;
    const addable = installedCatalog || (api !== null && baseURL !== null);
    const warnings = [...(provider.warnings ?? [])];
    if (installedEntry?.error) warnings.push(`Installed catalog: ${oneLine(installedEntry.error, 200)}`);
    const configuredRouteId = activeEntry?.routeId ?? (profileEntry === null ? null : profileEntry[0]);
    return {
      ...provider,
      routeId,
      displayName,
      api,
      baseURL,
      installedCatalog,
      configured: configuredRouteId !== null,
      configuredRouteId,
      configuredBaseURL: activeEntry?.baseURL ?? null,
      addable,
      addBlockReason: addable ? null : 'Protocol or endpoint is unknown; add this provider manually.',
      warnings: uniqueStrings(warnings),
      evidence: provider.evidence ?? [],
    };
  });
}

function providerMatches(provider, query) {
  if (query === '') return true;
  const needle = query.toLowerCase();
  if (String(provider.name ?? '').toLowerCase().includes(needle)) return true;
  if (String(provider.displayName ?? '').toLowerCase().includes(needle)) return true;
  if (String(provider.key ?? '').toLowerCase().includes(needle)) return true;
  if (String(provider.routeId ?? '').toLowerCase().includes(needle)) return true;
  return (provider.models ?? []).some((model) => (
    String(model.id ?? '').toLowerCase().includes(needle)
    || String(model.name ?? '').toLowerCase().includes(needle)
  ));
}

export class CatalogService {
  constructor({
    config = {},
    fetchJson = defaultFetchJson,
    sources = SOURCES,
    clock = Date.now,
  } = {}) {
    this.fetchJson = fetchJson;
    this.sources = sources;
    this.clock = clock;
    this.config = {
      cacheTtlMinutes: clampInt(config.cacheTtlMinutes, 5, 1440, 720),
      requestTimeoutMs: clampInt(config.requestTimeoutMs, 3000, 60000, 15000),
      sources: normalizeSourceConfig(config.sources, sources.map((source) => source.id)),
      includeTrialCredits: config.includeTrialCredits === true,
      maxModelsPerProvider: clampInt(config.maxModelsPerProvider, 1, 200, 50),
      deepSearchMaxResults: clampInt(config.deepSearchMaxResults, 1, 10, 6),
    };
    this.cache = null;
    this.cache = null;
    this.inflight = null;
    this.lastGood = new Map();
    this.disposed = false;
  }

  async refresh() {
    if (this.disposed) throw new SourceError('DISPOSED', 'catalog service is disposed');
    const selected = this.sources.filter((source) => this.config.sources.includes(source.id));
    const fetchedAt = nowIso(this.clock);
    const settled = await Promise.allSettled(selected.map(async (source) => {
      const value = await source.fetchSource(this.fetchJson, undefined);
      return { source, value };
    }));
    const records = [];
    const statuses = [];
    const warnings = [];
    for (const [index, result] of settled.entries()) {
      const source = selected[index];
      if (result.status === 'fulfilled') {
        const value = result.value.value;
        const providers = Array.isArray(value?.providers) ? value.providers : [];
        this.lastGood.set(source.id, { providers, fetchedAt });
        for (const provider of providers) {
          records.push({
            ...provider,
            sourceIds: uniqueStrings([...(provider.sourceIds ?? []), source.id]),
          });
        }
        statuses.push({
          id: source.id,
          label: source.label,
          status: 'ok',
          fetchedAt,
          providers: providers.length,
          models: providers.reduce((sum, provider) => sum + (provider.models?.length ?? 0), 0),
          error: null,
        });
        for (const warning of value?.warnings ?? []) warnings.push(`${source.label}: ${warning}`);
      } else {
        const info = errorInfo(result.reason, 'SOURCE_FAILED');
        const last = this.lastGood.get(source.id);
        if (last !== undefined) {
          for (const provider of last.providers) {
            records.push({
              ...provider,
              sourceIds: uniqueStrings([...(provider.sourceIds ?? []), source.id]),
            });
          }
          statuses.push({
            id: source.id,
            label: source.label,
            status: 'stale',
            fetchedAt: last.fetchedAt,
            providers: last.providers.length,
            models: last.providers.reduce((sum, provider) => sum + (provider.models?.length ?? 0), 0),
            error: info.message,
          });
          warnings.push(`${source.label}: using stale data (${info.message})`);
        } else {
          statuses.push({
            id: source.id,
            label: source.label,
            status: 'error',
            fetchedAt: null,
            providers: 0,
            models: 0,
            error: info.message,
          });
          warnings.push(`${source.label}: ${info.message}`);
        }
      }
    }
    const merged = mergeProviderRecords(records, { maxModelsPerProvider: this.config.maxModelsPerProvider });
    const raw = {
      generatedAt: fetchedAt,
      providers: merged,
      sources: statuses,
      warnings: uniqueStrings(warnings),
      stale: statuses.some((source) => source.status !== 'ok'),
    };
    this.cache = { raw, at: this.clock() };
    return raw;
  }

  async rawSnapshot({ force = false } = {}) {
    if (this.disposed) throw new SourceError('DISPOSED', 'catalog service is disposed');
    const ttl = this.config.cacheTtlMinutes * 60 * 1000;
    if (!force && this.cache !== null && this.clock() - this.cache.at < ttl) return this.cache.raw;
    if (this.inflight !== null) return this.inflight;
    this.inflight = this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async snapshot({ force = false, dshState = null, includeUnverified = false } = {}) {
    const raw = await this.rawSnapshot({ force });
    const enriched = enrichWithDsh(raw.providers, dshState);
    const providers = finalizeProviders(enriched, {
      includeUnverified,
      includeTrialCredits: this.config.includeTrialCredits,
      maxModelsPerProvider: this.config.maxModelsPerProvider,
    });
    const capabilities = dshState?.capabilities ?? {};
    return {
      generatedAt: raw.generatedAt,
      stale: raw.stale,
      warnings: uniqueStrings([...(raw.warnings ?? []), ...(dshState?.warnings ?? [])]),
      sources: raw.sources,
      counts: countCatalog(providers),
      providers,
      capabilities,
    };
  }

  async search({
    query = '',
    kind = 'all',
    api = 'all',
    minContext = 0,
    configuredOnly = false,
    includeUnverified = false,
    limit = 20,
    force = false,
    dshState = null,
  } = {}) {
    const snapshot = await this.snapshot({ force, dshState, includeUnverified });
    let providers = snapshot.providers.filter((provider) => providerMatches(provider, String(query ?? '').trim()));
    if (kind !== 'all') providers = providers.filter((provider) => provider.freeKind === kind);
    if (api !== 'all') providers = providers.filter((provider) => provider.api === api);
    if (configuredOnly) providers = providers.filter((provider) => provider.configured);
    if (minContext > 0) {
      providers = providers.map((provider) => ({
        ...provider,
        models: (provider.models ?? []).filter((model) => (model.contextWindow ?? 0) >= minContext),
      })).filter((provider) => provider.models.length > 0 || provider.freeKind === 'free_tier');
    }
    providers = providers.slice(0, clampInt(limit, 1, 50, 20));
    return {
      ...snapshot,
      providers,
      counts: countCatalog(providers),
    };
  }

  findProvider(snapshot, providerKey) {
    if (!snapshot || typeof providerKey !== 'string') return null;
    return snapshot.providers.find((provider) => provider.key === providerKey) ?? null;
  }

  dispose() {
    this.disposed = true;
    this.cache = null;
    this.inflight = null;
    this.lastGood.clear();
  }
}
