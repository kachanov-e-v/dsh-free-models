/**
 * Setup operations behind the Settings page.
 *
 * The page sends providerKey/modelIds/routeId, never a base URL, protocol, or
 * model metadata. This service looks everything up in the trusted catalog and
 * writes only through ctx.settings / ctx.credentials.
 */

import { providerConfigFragment } from './config.js';
import { collectDshState } from './state.js';
import {
  errorInfo,
  isRecord,
  normalizeApiKey,
  oneLine,
  timeoutSignal,
  truncate,
  validateEnvName,
  validateModelId,
  validateRouteId,
} from './util.js';

const TEST_PROMPT = 'Reply with the single word OK.';
const TEST_TIMEOUT_MS = 30000;
const PROVIDER_READY_TIMEOUT_MS = 10000;

function get(ctx, name) {
  try {
    return ctx.get(name);
  } catch {
    return undefined;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveEnvName(routeId) {
  return `${routeId.toUpperCase().replace(/[^A-Z0-9]+/gu, '_')}_API_KEY`;
}

function withoutUndefined(value) {
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) output[key] = entry;
  }
  return output;
}

function streamText(llm, options, signal) {
  return (async () => {
    let text = '';
    for await (const chunk of llm.stream({ ...options, signal })) {
      if (chunk.type === 'text-delta') text += chunk.text;
      if (chunk.type === 'finish') {
        const reason = chunk.reason;
        if (reason && (reason.kind === 'error' || reason.kind === 'aborted')) {
          const code = reason.failure?.code
            || (signal?.aborted ? 'ABORTED' : reason.kind === 'aborted' ? 'ABORTED' : 'LLM_ERROR');
          const message = reason.failure?.message
            || (reason.kind === 'aborted' ? 'Model call was cancelled' : 'Model call failed');
          const error = new Error(message);
          error.code = code;
          throw error;
        }
      }
    }
    return text;
  })();
}

export class SetupService {
  constructor({ ctx, catalog, collectState = () => collectDshState(ctx), sleepFn = sleep, clock = Date.now }) {
    this.ctx = ctx;
    this.catalog = catalog;
    this.collectState = collectState;
    this.sleepFn = sleepFn;
    this.clock = clock;
    this.testAt = new Map();
    this.keyAt = new Map();
  }

  async state() {
    return this.collectState();
  }

  async addProvider(request, { signal } = {}) {
    if (!isRecord(request)) return { ok: false, code: 'INVALID_REQUEST', message: 'Request body must be an object' };
    const providerKey = typeof request.providerKey === 'string' ? request.providerKey.trim() : '';
    if (providerKey === '') return { ok: false, code: 'INVALID_PROVIDER', message: 'providerKey is required' };
    const routeId = typeof request.routeId === 'string' ? request.routeId.trim() : '';
    const routeError = validateRouteId(routeId);
    if (routeError !== null) return { ok: false, code: 'INVALID_ROUTE_ID', message: routeError };
    const modelIds = Array.isArray(request.modelIds)
      ? [...new Set(request.modelIds.filter((id) => typeof id === 'string'))]
      : [];
    if (modelIds.length > 100) return { ok: false, code: 'TOO_MANY_MODELS', message: 'Select at most 100 models' };
    for (const id of modelIds) {
      const modelError = validateModelId(id);
      if (modelError !== null) return { ok: false, code: 'INVALID_MODEL', message: modelError };
    }
    const useEnv = request.useEnv === true;
    let apiKey = null;
    if (!useEnv && typeof request.apiKey === 'string' && request.apiKey !== '') {
      const normalized = normalizeApiKey(request.apiKey);
      if (!normalized.ok) return { ok: false, code: 'INVALID_KEY', message: normalized.reason };
      apiKey = normalized.value;
    }

    const dshState = await this.collectState();
    if (dshState.settings === null || dshState.settings === undefined) {
      return { ok: false, code: 'SETTINGS_UNAVAILABLE', message: 'llm-pi-ai settings are not available' };
    }
    if (dshState.settings.writable === false) {
      return { ok: false, code: 'SETTINGS_READ_ONLY', message: 'This profile does not accept settings writes' };
    }
    const settingsService = get(this.ctx, 'settings');
    if (settingsService === undefined) {
      return { ok: false, code: 'SETTINGS_UNAVAILABLE', message: 'The settings service is not loaded' };
    }

    const snapshot = await this.catalog.snapshot({ dshState, includeUnverified: request.includeUnverified === true });
    const provider = snapshot.providers.find((entry) => entry.key === providerKey);
    if (provider === undefined) {
      return { ok: false, code: 'UNKNOWN_PROVIDER', message: 'Provider is not in the catalog' };
    }
    if (!provider.addable) {
      return { ok: false, code: 'NOT_ADDABLE', message: provider.addBlockReason ?? 'This provider cannot be added automatically' };
    }

    const current = dshState.settings.providers?.[routeId];
    const activeRoute = Array.isArray(dshState.active)
      ? dshState.active.find((entry) => entry.routeId === routeId)
      : undefined;
    if (activeRoute !== undefined && current === undefined) {
      return {
        ok: false,
        code: 'ROUTE_OWNED_BY_OTHER_ADAPTER',
        message: `Route "${routeId}" is already active and is not an llm-pi-ai profile; choose another route id`,
      };
    }

    const built = providerConfigFragment(provider, {
      routeId,
      modelIds,
      dshState,
      current,
    });
    if (!built.ok) return built;

    let apiKeyEnv = typeof request.apiKeyEnv === 'string' && request.apiKeyEnv.trim() !== ''
      ? request.apiKeyEnv.trim()
      : built.profile.apiKeyEnv ?? null;
    if (apiKeyEnv === null && (apiKey !== null || request.test === true)) {
      apiKeyEnv = deriveEnvName(routeId);
    }
    if (apiKeyEnv !== null) {
      const allowed = new Set([
        provider.apiKeyEnv,
        ...(provider.apiKeyEnvAliases ?? []),
        deriveEnvName(routeId),
        current && typeof current === 'object' ? current.apiKeyEnv : null,
      ].filter((value) => typeof value === 'string' && value !== ''));
      if (!allowed.has(apiKeyEnv)) {
        return { ok: false, code: 'UNKNOWN_CREDENTIAL_REF', message: 'This credential reference is not used by the selected provider' };
      }
      const envError = validateEnvName(apiKeyEnv);
      if (envError !== null) return { ok: false, code: 'INVALID_ENV', message: envError };
      built.profile.apiKeyEnv = apiKeyEnv;
    } else {
      delete built.profile.apiKeyEnv;
    }

    const revision = dshState.settings.revision;
    if (!Number.isInteger(revision)) {
      return { ok: false, code: 'SETTINGS_CONFLICT', message: 'Could not read the current settings revision; refresh and retry' };
    }
    try {
      await settingsService.update(
        dshState.settings.namespace ?? 'llm-pi-ai',
        { providers: { [routeId]: built.profile } },
        revision,
      );
    } catch (error) {
      const info = errorInfo(error, 'SETTINGS_WRITE_FAILED');
      return { ok: false, code: info.code, message: info.message };
    }

    const warnings = [];
    let credential = null;
    if (apiKey !== null && !useEnv && apiKeyEnv !== null) {
      credential = await this.setCredential({ ref: apiKeyEnv, key: apiKey, allowedRefs: new Set([apiKeyEnv]) });
      if (!credential.ok) warnings.push(credential.message);
    } else if (apiKey !== null && apiKeyEnv === null) {
      warnings.push('No credential reference is available; the key was not stored.');
    } else if (apiKeyEnv !== null) {
      const credentials = get(this.ctx, 'credentials');
      if (credentials !== undefined) {
        try {
          const status = await credentials.describe(apiKeyEnv);
          credential = { ok: true, ref: apiKeyEnv, configured: status.configured, source: status.source ?? null };
        } catch {
          credential = { ok: true, ref: apiKeyEnv, configured: false, source: null };
        }
      }
    }

    let test = null;
    if (request.test === true) {
      if (credential !== null && credential.ok === false) {
        warnings.push('The test was skipped because the API key was not saved.');
      } else {
        const model = typeof request.testModelId === 'string' && request.testModelId !== ''
          ? request.testModelId
          : (modelIds[0] ?? provider.models?.[0]?.id ?? '');
        if (model === '') {
          warnings.push('The provider was added, but no model is available for a test; fetch models first.');
        } else {
          test = await this.testModel({ provider: routeId, model }, { signal });
        }
      }
    }

    return {
      ok: true,
      routeId,
      created: current === undefined,
      modelCount: built.modelCount,
      profile: built.profile,
      fragment: built.fragment,
      yaml: built.yaml,
      credential,
      test,
      warnings,
    };
  }

  async setCredential({ ref, key, allowedRefs } = {}) {
    if (typeof ref !== 'string' || ref === '') return { ok: false, code: 'INVALID_REF', message: 'Credential reference is required' };
    if (allowedRefs !== undefined && !(allowedRefs instanceof Set ? allowedRefs.has(ref) : Array.isArray(allowedRefs) && allowedRefs.includes(ref))) {
      return { ok: false, code: 'UNKNOWN_CREDENTIAL_REF', message: 'This credential reference is not used by a known provider' };
    }
    const envError = validateEnvName(ref);
    if (envError !== null) return { ok: false, code: 'INVALID_REF', message: envError };
    const normalized = normalizeApiKey(key);
    if (!normalized.ok) return { ok: false, code: 'INVALID_KEY', message: normalized.reason };
    const now = this.clock();
    const last = this.keyAt.get(ref) ?? 0;
    if (now - last < 2000) return { ok: false, code: 'KEY_TOO_FREQUENT', message: 'Wait a moment before saving another key' };
    this.keyAt.set(ref, now);
    const credentials = get(this.ctx, 'credentials');
    if (credentials === undefined) return { ok: false, code: 'CREDENTIALS_UNAVAILABLE', message: 'The credentials service is not loaded' };
    try {
      const status = await credentials.describe(ref);
      if (status.configured === true && status.writable === false) {
        return { ok: false, code: 'CREDENTIAL_READ_ONLY', message: 'This credential is provided by the environment and cannot be overwritten here' };
      }
      await credentials.set(ref, normalized.value);
      const after = await credentials.describe(ref);
      return { ok: true, ref, configured: after.configured === true, source: after.source ?? null };
    } catch (error) {
      const info = errorInfo(error, 'CREDENTIAL_WRITE_FAILED');
      return { ok: false, code: info.code, message: info.message };
    }
  }

  async waitForProvider(routeId, signal) {
    const llm = get(this.ctx, 'llm');
    if (llm === undefined) return false;
    const deadline = this.clock() + PROVIDER_READY_TIMEOUT_MS;
    while (this.clock() <= deadline) {
      if (signal?.aborted) return false;
      let providers = [];
      try {
        providers = llm.listProviders();
      } catch {
        providers = [];
      }
      if (Array.isArray(providers) && providers.some((entry) => (
        (typeof entry?.id === 'string' && entry.id === routeId)
        || (typeof entry?.provider === 'string' && entry.provider === routeId)
      ))) return true;
      await this.sleepFn(250);
    }
    return false;
  }

  async testModel({ provider, model } = {}, { signal } = {}) {
    if (typeof provider !== 'string' || provider === '') return { ok: false, code: 'INVALID_PROVIDER', message: 'Provider is required' };
    const modelError = validateModelId(model);
    if (modelError !== null) return { ok: false, code: 'INVALID_MODEL', message: modelError };
    const llm = get(this.ctx, 'llm');
    if (llm === undefined) return { ok: false, code: 'LLM_UNAVAILABLE', message: 'The llm service is not loaded' };
    const now = this.clock();
    const key = `${provider}/${model}`;
    const last = this.testAt.get(key) ?? 0;
    if (now - last < 10000) return { ok: false, code: 'TEST_TOO_FREQUENT', message: 'Wait a few seconds before testing again' };
    this.testAt.set(key, now);

    const ready = await this.waitForProvider(provider, signal);
    if (!ready) return { ok: false, code: 'PROVIDER_NOT_READY', message: 'The provider route is not active yet; wait and retry' };

    const started = this.clock();
    const timeout = timeoutSignal(signal, TEST_TIMEOUT_MS);
    try {
      const text = await streamText(llm, {
        provider,
        model,
        messages: [{ role: 'user', content: [{ type: 'text', text: TEST_PROMPT }] }],
        maxTokens: 24,
        temperature: 0,
      }, timeout);
      return {
        ok: true,
        provider,
        model,
        latencyMs: this.clock() - started,
        text: oneLine(text, 200),
      };
    } catch (error) {
      const info = errorInfo(error, timeout.aborted && !signal?.aborted ? 'TIMEOUT' : 'TEST_FAILED');
      const code = timeout.aborted && !signal?.aborted ? 'TIMEOUT' : info.code;
      const message = code === 'TIMEOUT' ? 'The provider did not answer within 30 seconds' : info.message;
      return { ok: false, code, message, latencyMs: this.clock() - started };
    }
  }

  async discoverModels(request, { signal } = {}) {
    if (!isRecord(request)) return { ok: false, code: 'INVALID_REQUEST', message: 'Request body must be an object' };
    const llm = get(this.ctx, 'llm');
    if (llm === undefined) return { ok: false, code: 'LLM_UNAVAILABLE', message: 'The llm service is not loaded' };
    const provider = typeof request.provider === 'string' && request.provider !== '' ? request.provider : undefined;
    const baseURL = typeof request.baseURL === 'string' && request.baseURL !== '' ? request.baseURL : undefined;
    const api = typeof request.api === 'string' && request.api !== '' ? request.api : undefined;
    let apiKey;
    if (typeof request.apiKey === 'string' && request.apiKey !== '') {
      const normalized = normalizeApiKey(request.apiKey);
      if (!normalized.ok) return { ok: false, code: 'INVALID_KEY', message: normalized.reason };
      apiKey = normalized.value;
    }
    if (provider === undefined && baseURL === undefined) {
      return { ok: false, code: 'INVALID_DISCOVERY', message: 'Provide a provider route or a baseURL' };
    }
    const payload = withoutUndefined({ provider, baseURL, api, apiKey });
    try {
      const models = await llm.discoverModels('llm-pi-ai', payload, signal);
      return {
        ok: true,
        models: (Array.isArray(models) ? models : [])
          .filter((model) => model && typeof model.id === 'string' && model.id !== '')
          .map((model) => ({
            id: model.id,
            name: typeof model.name === 'string' ? model.name : model.id,
            contextWindow: Number.isFinite(model.contextWindow) ? model.contextWindow : null,
            maxTokens: Number.isFinite(model.maxTokens) ? model.maxTokens : null,
            inputModalities: Array.isArray(model.inputModalities) ? [...model.inputModalities] : null,
          })),
      };
    } catch (error) {
      const info = errorInfo(error, 'DISCOVERY_FAILED');
      return { ok: false, code: info.code, message: truncate(info.message, 300) };
    }
  }
}
