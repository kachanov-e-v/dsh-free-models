/**
 * Build the llm-pi-ai provider fragment and render it as YAML or JSON.
 *
 * The host builds this from the catalog record; the client never supplies a
 * base URL, protocol, or model metadata. A model id is only accepted when the
 * catalog already knows it.
 */

import {
  isRecord,
  safeHttpUrl,
  validateEnvName,
  validateModelId,
  validateRouteId,
} from './util.js';

const PROTOCOLS = new Set(['openai-completions', 'openai-responses', 'anthropic-messages']);
const SUPPORTED_INPUT = new Set(['text', 'image']);

function installedEntryFor(provider, dshState, routeId) {
  const installed = Array.isArray(dshState?.installed) ? dshState.installed : [];
  const byRoute = installed.find((entry) => entry.provider === routeId);
  if (byRoute !== undefined) return byRoute;
  if (routeId === provider.key) {
    return installed.find((entry) => entry.provider === provider.key) ?? null;
  }
  return null;
}

function compactModel(model) {
  const output = { id: model.id };
  if (typeof model.name === 'string' && model.name !== '' && model.name !== model.id) output.name = model.name;
  if (Number.isFinite(model.contextWindow) && model.contextWindow > 0) output.contextWindow = Math.trunc(model.contextWindow);
  if (Number.isFinite(model.maxTokens) && model.maxTokens > 0) output.maxTokens = Math.trunc(model.maxTokens);
  if (Array.isArray(model.input) && model.input.length > 0) {
    const input = [...new Set(model.input.filter((modality) => SUPPORTED_INPUT.has(modality)))];
    if (input.length > 0) output.input = input;
  }
  return output;
}

function sanitizeModel(model) {
  if (!isRecord(model)) return null;
  const output = { ...model };
  if (Array.isArray(output.input)) {
    const input = [...new Set(output.input.filter((modality) => SUPPORTED_INPUT.has(modality)))];
    if (input.length > 0) output.input = input;
    else delete output.input;
  }
  return output;
}

export function mergeModels(existing, incoming) {
  const merged = new Map();
  for (const model of Array.isArray(existing) ? existing : []) {
    const sanitized = sanitizeModel(model);
    if (sanitized !== null && typeof sanitized.id === 'string' && sanitized.id !== '') merged.set(sanitized.id, sanitized);
  }
  for (const model of Array.isArray(incoming) ? incoming : []) {
    const sanitized = sanitizeModel(model);
    if (sanitized !== null && typeof sanitized.id === 'string' && sanitized.id !== '' && !merged.has(sanitized.id)) {
      merged.set(sanitized.id, sanitized);
    }
  }
  return [...merged.values()];
}

/**
 * Build one provider profile. Returns { ok, profile, modelCount } or
 * { ok: false, code, message }.
 */
export function buildProviderProfile(provider, {
  routeId = provider?.routeId,
  modelIds = [],
  dshState = null,
} = {}) {
  if (!isRecord(provider)) {
    return { ok: false, code: 'UNKNOWN_PROVIDER', message: 'Provider is not in the catalog' };
  }
  const routeError = validateRouteId(routeId);
  if (routeError !== null) return { ok: false, code: 'INVALID_ROUTE_ID', message: routeError };
  const installed = installedEntryFor(provider, dshState, routeId);
  const declared = installed === null ? true : installed.declared === true;
  const api = declared ? provider.api : null;
  if (declared && (typeof api !== 'string' || !PROTOCOLS.has(api))) {
    return { ok: false, code: 'NOT_ADDABLE', message: 'This provider has no known OpenAI/Anthropic-compatible protocol' };
  }
  const baseURL = declared ? provider.baseURL : null;
  if (declared && (typeof baseURL !== 'string' || safeHttpUrl(baseURL, { allowLocalhost: true }) === null)) {
    return { ok: false, code: 'NOT_ADDABLE', message: 'This provider has no usable endpoint' };
  }
  const apiKeyEnv = provider.apiKeyEnv ?? null;
  if (apiKeyEnv !== null) {
    const envError = validateEnvName(apiKeyEnv);
    if (envError !== null) return { ok: false, code: 'INVALID_ENV', message: envError };
  }

  const available = new Map();
  for (const model of provider.models ?? []) {
    if (model && typeof model.id === 'string') available.set(model.id, model);
  }
  const requested = Array.isArray(modelIds) ? [...new Set(modelIds)] : [];
  const selected = [];
  for (const id of requested) {
    const modelError = validateModelId(id);
    if (modelError !== null) return { ok: false, code: 'INVALID_MODEL', message: modelError };
    const model = available.get(id);
    if (model === undefined) {
      return { ok: false, code: 'UNKNOWN_MODEL', message: `Model "${id}" is not in the catalog for this provider` };
    }
    selected.push(compactModel(model));
  }
  if (!declared && selected.length === 0) {
    // An installed catalog route can serve its whole catalog; no model list is
    // required and nothing is invented.
  }
  if (declared && selected.length === 0) {
    return { ok: false, code: 'MODEL_REQUIRED', message: 'Select at least one model for a hand-declared provider' };
  }

  const profile = {
    displayName: provider.displayName ?? provider.name ?? routeId,
  };
  if (declared) {
    profile.api = api;
    profile.baseURL = baseURL;
  }
  if (apiKeyEnv !== null) profile.apiKeyEnv = apiKeyEnv;
  if (selected.length > 0) profile.models = selected;
  return {
    ok: true,
    profile,
    routeId,
    declared,
    installedCatalog: !declared,
    modelCount: selected.length,
  };
}

export function applyExistingProvider(profile, { current, merge = true } = {}) {
  if (!isRecord(profile)) return { ok: false, code: 'INVALID_PROFILE', message: 'Profile is invalid' };
  if (!isRecord(current)) return { ok: true, profile, merged: false };
  const currentApi = typeof current.api === 'string' ? current.api : null;
  const nextApi = typeof profile.api === 'string' ? profile.api : null;
  if (currentApi !== null && nextApi !== null && currentApi !== nextApi) {
    return {
      ok: false,
      code: 'ROUTE_CONFLICT',
      message: `Route already uses protocol "${currentApi}", but the catalog suggests "${nextApi}"`,
    };
  }
  const currentBaseURL = typeof current.baseURL === 'string' ? current.baseURL : null;
  const nextBaseURL = typeof profile.baseURL === 'string' ? profile.baseURL : null;
  if (currentBaseURL !== null && nextBaseURL !== null && currentBaseURL.replace(/\/+$/u, '') !== nextBaseURL.replace(/\/+$/u, '')) {
    return {
      ok: false,
      code: 'ROUTE_CONFLICT',
      message: 'Route already uses a different endpoint',
    };
  }
  const merged = { ...profile };
  if (currentApi !== null && merged.api === undefined) merged.api = currentApi;
  if (currentBaseURL !== null && merged.baseURL === undefined) merged.baseURL = currentBaseURL;
  if (typeof current.apiKeyEnv === 'string' && current.apiKeyEnv !== '') merged.apiKeyEnv = current.apiKeyEnv;
  if (typeof current.displayName === 'string' && current.displayName !== '') {
    merged.displayName = current.displayName;
  }
  if (merge) {
    merged.models = mergeModels(current.models, profile.models);
    if (merged.models.length === 0) delete merged.models;
  }
  return { ok: true, profile: merged, merged: true };
}

function yamlKey(value) {
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) return value;
  return JSON.stringify(value);
}

function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  if (text === '') return '""';
  if (
    /^[A-Za-z0-9_./@:+-]+$/u.test(text)
    && !/^(true|false|null|yes|no|on|off)$/iu.test(text)
    && !text.startsWith('-')
    && !text.startsWith('?')
    && !text.startsWith(':')
    && !text.includes(' #')
  ) return text;
  return JSON.stringify(text);
}

function emitObject(value, indent, lines) {
  for (const [key, child] of Object.entries(value)) {
    const prefix = `${' '.repeat(indent)}${yamlKey(key)}:`;
    if (Array.isArray(child)) {
      if (child.length === 0) {
        lines.push(`${prefix} []`);
        continue;
      }
      lines.push(prefix);
      for (const item of child) {
        if (isRecord(item)) {
          const keys = Object.keys(item);
          if (keys.length === 0) {
            lines.push(`${' '.repeat(indent + 2)}- {}`);
            continue;
          }
          const [first, ...rest] = keys;
          lines.push(`${' '.repeat(indent + 2)}- ${yamlKey(first)}: ${yamlScalar(item[first])}`);
          for (const restKey of rest) {
            const restValue = item[restKey];
            if (Array.isArray(restValue)) {
              if (restValue.length === 0) lines.push(`${' '.repeat(indent + 4)}${yamlKey(restKey)}: []`);
              else {
                lines.push(`${' '.repeat(indent + 4)}${yamlKey(restKey)}:`);
                for (const childItem of restValue) {
                  lines.push(`${' '.repeat(indent + 6)}- ${yamlScalar(childItem)}`);
                }
              }
            } else {
              lines.push(`${' '.repeat(indent + 4)}${yamlKey(restKey)}: ${yamlScalar(restValue)}`);
            }
          }
        } else {
          lines.push(`${' '.repeat(indent + 2)}- ${yamlScalar(item)}`);
        }
      }
    } else if (isRecord(child)) {
      if (Object.keys(child).length === 0) {
        lines.push(`${prefix} {}`);
        continue;
      }
      lines.push(prefix);
      emitObject(child, indent + 2, lines);
    } else {
      lines.push(`${prefix} ${yamlScalar(child)}`);
    }
  }
}

export function toYaml(value) {
  const lines = [];
  emitObject(value, 0, lines);
  return `${lines.join('\n')}\n`;
}

export function providerConfigFragment(provider, { routeId, modelIds, dshState, current } = {}) {
  const built = buildProviderProfile(provider, { routeId, modelIds, dshState });
  if (!built.ok) return built;
  const applied = applyExistingProvider(built.profile, { current, merge: true });
  if (!applied.ok) return applied;
  const fragment = { providers: { [built.routeId]: applied.profile } };
  return {
    ok: true,
    routeId: built.routeId,
    profile: applied.profile,
    fragment,
    yaml: toYaml(fragment),
    json: `${JSON.stringify(fragment, null, 2)}\n`,
    modelCount: Array.isArray(applied.profile.models) ? applied.profile.models.length : built.modelCount,
    declared: built.declared,
    installedCatalog: built.installedCatalog,
  };
}
