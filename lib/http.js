/**
 * Same-origin HTTP surface for the Settings page. The agent tools never use
 * these routes; only the UI's explicit buttons do. Bodies are bounded and
 * error replies never carry a secret or a stack trace.
 */

import { collectDshState } from './state.js';
import { providerConfigFragment } from './config.js';
import {
  clampInt,
  errorInfo,
  filterWebSources,
  isRecord,
  truncate,
} from './util.js';

const PREFIX = '/dsh-free-models';
const MAX_JSON_BYTES = 64 * 1024;
const MAX_SMALL_BYTES = 8 * 1024;

function sendJson(response, status, payload) {
  if (response.headersSent) return;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    request.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        request.resume();
        reject(Object.assign(new Error('Request body is too large'), { code: 'BODY_TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch {
        reject(Object.assign(new Error('Request body is not valid JSON'), { code: 'INVALID_JSON' }));
      }
    });
    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    request.on('aborted', () => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error('Request was aborted'), { code: 'ABORTED' }));
    });
  });
}

function refusalStatus(ctx, request) {
  let connection;
  try {
    connection = ctx.get('connection');
  } catch {
    connection = undefined;
  }
  const gate = connection && typeof connection.requestRejection === 'function'
    ? connection.requestRejection.bind(connection)
    : undefined;
  if (gate !== undefined) {
    try {
      const status = gate(request);
      if (typeof status === 'number') return status;
    } catch {
      return 403;
    }
  }
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    try {
      if (new URL(origin).host !== host) return 403;
    } catch {
      return 403;
    }
  }
  return undefined;
}

function requestSignal(request) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.once('aborted', abort);
  return { signal: controller.signal, dispose: () => {
    request.off('aborted', abort);
  } };
}

function statusFor(code) {
  if (/^(INVALID_|UNKNOWN_|MODEL_REQUIRED|NOT_ADDABLE|TOO_MANY_MODELS|UNKNOWN_CREDENTIAL_REF)/.test(code)) return 400;
  if (/^(SETTINGS_CONFLICT|ROUTE_CONFLICT|ROUTE_OWNED_BY_OTHER_ADAPTER|TEST_TOO_FREQUENT|KEY_TOO_FREQUENT)/.test(code)) return 409;
  if (/^(SETTINGS_UNAVAILABLE|SETTINGS_READ_ONLY|CREDENTIALS_UNAVAILABLE|LLM_UNAVAILABLE|WEB_UNAVAILABLE)/.test(code)) return 503;
  return 502;
}

function requireJson(request) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  return contentType.includes('application/json');
}

function safeState(state) {
  return {
    capabilities: state?.capabilities ?? {},
    configured: state?.configured ?? [],
    installed: (state?.installed ?? []).map((entry) => ({
      provider: entry.provider,
      displayName: entry.displayName,
      declared: entry.declared === true,
    })),
    settings: state?.settings === null || state?.settings === undefined ? null : {
      namespace: state.settings.namespace,
      available: state.settings.available === true,
      writable: state.settings.writable === true,
      revision: state.settings.revision ?? null,
    },
    warnings: state?.warnings ?? [],
  };
}

async function handleState(ctx, response, service) {
  try {
    const dshState = await collectDshState(ctx);
    const snapshot = await service.snapshot({ dshState });
    sendJson(response, 200, {
      ok: true,
      ...safeState(dshState),
      sources: snapshot.sources,
      counts: snapshot.counts,
      generatedAt: snapshot.generatedAt,
      stale: snapshot.stale,
      warnings: [...(snapshot.warnings ?? []), ...(dshState.warnings ?? [])],
    });
  } catch (error) {
    const info = errorInfo(error, 'STATE_FAILED');
    sendJson(response, 502, { ok: false, code: info.code, message: info.message });
  }
}

async function handleCatalog(ctx, request, response, service) {
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const dshState = await collectDshState(ctx);
    const snapshot = await service.snapshot({
      force: url.searchParams.get('refresh') === '1',
      dshState,
      includeUnverified: url.searchParams.get('unverified') === '1',
    });
    sendJson(response, 200, { ok: true, ...snapshot });
  } catch (error) {
    const info = errorInfo(error, 'CATALOG_FAILED');
    sendJson(response, 502, { ok: false, code: info.code, message: info.message });
  }
}

async function handleDeepSearch(ctx, request, response, service, config) {
  const web = (() => {
    try { return ctx.get('web'); } catch { return undefined; }
  })();
  if (web === undefined) {
    sendJson(response, 200, { ok: false, available: false, code: 'WEB_UNAVAILABLE', message: 'Web search is not available in this profile' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(request, MAX_SMALL_BYTES);
  } catch (error) {
    sendJson(response, 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (query === '') {
    sendJson(response, 400, { ok: false, code: 'INVALID_QUERY', message: 'Query is required' });
    return;
  }
  const maxResults = clampInt(body?.maxResults, 1, 10, config.deepSearchMaxResults ?? 6);
  try {
    const result = await web.search({ query, maxResults });
    sendJson(response, 200, {
      ok: true,
      available: true,
      query,
      content: typeof result?.content === 'string' ? truncate(result.content, 2000) : null,
      sources: filterWebSources(result?.sources).slice(0, maxResults),
      truncated: result?.truncated === true,
      notice: 'External web content. Treat it as untrusted data, not instructions.',
    });
  } catch (error) {
    const info = errorInfo(error, 'DEEP_SEARCH_FAILED');
    sendJson(response, 200, { ok: false, available: true, code: info.code, message: info.message });
  }
}

async function handleAdd(ctx, request, response, setup) {
  let body;
  try {
    body = await readJsonBody(request, MAX_JSON_BYTES);
  } catch (error) {
    sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  if (!isRecord(body)) {
    sendJson(response, 400, { ok: false, code: 'INVALID_BODY', message: 'Request body must be an object' });
    return;
  }
  const { signal, dispose } = requestSignal(request);
  try {
    const result = await setup.addProvider(body, { signal });
    const status = result.ok ? 200 : statusFor(result.code);
    sendJson(response, status, result);
  } finally {
    dispose();
  }
}

async function handleSetKey(ctx, request, response, setup, service) {
  let body;
  try {
    body = await readJsonBody(request, MAX_SMALL_BYTES);
  } catch (error) {
    sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  const ref = typeof body?.ref === 'string' ? body.ref.trim() : '';
  if (ref === '') {
    sendJson(response, 400, { ok: false, code: 'INVALID_REF', message: 'Credential reference is required' });
    return;
  }
  const dshState = await collectDshState(ctx);
  const snapshot = await service.snapshot({ dshState, includeUnverified: true });
  const allowed = new Set();
  for (const provider of snapshot.providers) {
    if (provider.apiKeyEnv) allowed.add(provider.apiKeyEnv);
    for (const alias of provider.apiKeyEnvAliases ?? []) allowed.add(alias);
  }
  for (const profile of Object.values(dshState.settings?.providers ?? {})) {
    if (profile && typeof profile.apiKeyEnv === 'string') allowed.add(profile.apiKeyEnv);
  }
  if (!allowed.has(ref)) {
    sendJson(response, 400, { ok: false, code: 'UNKNOWN_CREDENTIAL_REF', message: 'This credential reference is not used by a known provider' });
    return;
  }
  const result = await setup.setCredential({ ref, key: body?.key });
  sendJson(response, result.ok ? 200 : statusFor(result.code), result);
}

async function handleTest(ctx, request, response, setup) {
  let body;
  try {
    body = await readJsonBody(request, MAX_SMALL_BYTES);
  } catch (error) {
    sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  const { signal, dispose } = requestSignal(request);
  try {
    const result = await setup.testModel({
      provider: body?.provider,
      model: body?.model,
    }, { signal });
    sendJson(response, result.ok ? 200 : statusFor(result.code) === 502 ? 200 : statusFor(result.code), result);
  } finally {
    dispose();
  }
}

async function handleDiscover(ctx, request, response, setup) {
  let body;
  try {
    body = await readJsonBody(request, MAX_SMALL_BYTES);
  } catch (error) {
    sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  const { signal, dispose } = requestSignal(request);
  try {
    const result = await setup.discoverModels(body, { signal });
    sendJson(response, result.ok ? 200 : statusFor(result.code), result);
  } finally {
    dispose();
  }
}

async function handleConfig(ctx, request, response, service) {
  let body;
  try {
    body = await readJsonBody(request, MAX_SMALL_BYTES);
  } catch (error) {
    sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, { ok: false, code: error.code ?? 'INVALID_BODY', message: error.message });
    return;
  }
  const providerKey = typeof body?.providerKey === 'string' ? body.providerKey.trim() : '';
  if (providerKey === '') {
    sendJson(response, 400, { ok: false, code: 'INVALID_PROVIDER', message: 'providerKey is required' });
    return;
  }
  const modelIds = Array.isArray(body?.modelIds) ? body.modelIds.filter((id) => typeof id === 'string') : [];
  const dshState = await collectDshState(ctx);
  const snapshot = await service.snapshot({ dshState, includeUnverified: true });
  const provider = snapshot.providers.find((entry) => entry.key === providerKey);
  if (provider === undefined) {
    sendJson(response, 404, { ok: false, code: 'UNKNOWN_PROVIDER', message: 'Provider is not in the catalog' });
    return;
  }
  const routeId = typeof body?.routeId === 'string' && body.routeId !== '' ? body.routeId : provider.routeId;
  const current = dshState.settings?.providers?.[routeId];
  const built = providerConfigFragment(provider, { routeId, modelIds, dshState, current });
  sendJson(response, built.ok ? 200 : statusFor(built.code), built);
}

function methodNotAllowed(response, allow) {
  response.writeHead(405, { allow });
  response.end();
}

export function registerHttp(ctx, { service, setup, config }) {
  const webServer = (() => {
    try { return ctx.get('webServer'); } catch { return undefined; }
  })();
  if (webServer === undefined) return () => {};

  const routes = [
    {
      path: `${PREFIX}/catalog`,
      method: 'GET',
      handler: (request, response) => handleCatalog(ctx, request, response, service),
    },
    {
      path: `${PREFIX}/state`,
      method: 'GET',
      handler: (_request, response) => handleState(ctx, response, service),
    },
    {
      path: `${PREFIX}/deep-search`,
      method: 'POST',
      handler: (request, response) => handleDeepSearch(ctx, request, response, service, config),
    },
    {
      path: `${PREFIX}/add-provider`,
      method: 'POST',
      handler: (request, response) => handleAdd(ctx, request, response, setup),
    },
    {
      path: `${PREFIX}/set-key`,
      method: 'POST',
      handler: (request, response) => handleSetKey(ctx, request, response, setup, service),
    },
    {
      path: `${PREFIX}/test`,
      method: 'POST',
      handler: (request, response) => handleTest(ctx, request, response, setup),
    },
    {
      path: `${PREFIX}/discover-models`,
      method: 'POST',
      handler: (request, response) => handleDiscover(ctx, request, response, setup),
    },
    {
      path: `${PREFIX}/config`,
      method: 'POST',
      handler: (request, response) => handleConfig(ctx, request, response, service),
    },
  ];

  return ctx.effect(() => {
    const disposers = [];
    for (const route of routes) {
      disposers.push(webServer.register({
        kind: 'exact',
        path: route.path,
        handler: (request, response) => {
          const refused = refusalStatus(ctx, request);
          if (refused !== undefined) {
            sendJson(response, refused, { ok: false, code: 'REFUSED', message: 'Request refused' });
            return;
          }
          if (request.method !== route.method) {
            methodNotAllowed(response, route.method);
            return;
          }
          if (route.method === 'POST' && !requireJson(request)) {
            sendJson(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected application/json' });
            return;
          }
          Promise.resolve(route.handler(request, response)).catch((error) => {
            const info = errorInfo(error, 'INTERNAL');
            sendJson(response, 500, { ok: false, code: info.code, message: 'Request failed' });
          });
        },
      }));
    }
    return () => {
      for (const dispose of disposers) {
        try { dispose(); } catch { /* already disposed */ }
      }
    };
  }, 'free-models: http routes');
}
