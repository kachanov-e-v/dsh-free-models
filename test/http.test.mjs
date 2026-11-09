import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';

import { registerHttp } from '../lib/http.js';

const snapshot = {
  generatedAt: '2026-11-09T12:00:00.000Z',
  stale: false,
  warnings: [],
  sources: [],
  counts: { providers: 0, models: 0, byKind: {} },
  providers: [],
};

function makeContext(overrides = {}) {
  const routes = [];
  const settings = {
    writable: true,
    describe() {
      return [{ ns: 'llm-pi-ai', revision: 1, value: { providers: {} } }];
    },
  };
  const llm = {
    listConfigurableProviders() { return []; },
    listProviders() { return []; },
  };
  const credentials = {
    async describe() { return { configured: false, writable: true }; },
  };
  const webServer = {
    register(route) {
      routes.push(route);
      return () => {};
    },
  };
  const services = {
    webServer,
    settings,
    llm,
    credentials,
    ...(overrides.services ?? {}),
  };
  const ctx = {
    get(name) {
      if (name in services) return services[name];
      throw new Error(`missing ${name}`);
    },
    effect(fn) {
      return fn();
    },
  };
  const service = {
    async snapshot() { return snapshot; },
    ...(overrides.service ?? {}),
  };
  const setup = {
    async addProvider() { return { ok: true, routeId: 'acme' }; },
    async setCredential() { return { ok: true, ref: 'ACME_API_KEY', configured: true }; },
    async testModel() { return { ok: true }; },
    async discoverModels() { return { ok: true, models: [] }; },
    ...(overrides.setup ?? {}),
  };
  const dispose = registerHttp(ctx, { service, setup, config: { deepSearchMaxResults: 6 } });
  return { routes, ctx, service, setup, dispose };
}

function request(route, { method = 'GET', url = route.path, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:11078', ...headers };
    let status = 0;
    let responseHeaders = {};
    let finished = false;
    const res = {
      headersSent: false,
      writeHead(code, values) {
        status = code;
        responseHeaders = values ?? {};
        this.headersSent = true;
      },
      end(payload = '') {
        if (finished) return;
        finished = true;
        let json = null;
        try { json = JSON.parse(payload); } catch { json = null; }
        resolve({ status, headers: responseHeaders, json, text: payload });
      },
    };
    try {
      route.handler(req, res);
    } catch (error) {
      reject(error);
      return;
    }
    if (body !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(body)));
    }
    req.emit('end');
  });
}

test('catalog route returns the snapshot', async () => {
  const { routes } = makeContext();
  const route = routes.find((entry) => entry.path === '/dsh-free-models/catalog');
  const result = await request(route);
  assert.equal(result.status, 200);
  assert.equal(result.json.ok, true);
});

test('POST routes require application/json', async () => {
  const { routes } = makeContext();
  const route = routes.find((entry) => entry.path === '/dsh-free-models/add-provider');
  const result = await request(route, { method: 'POST', body: { providerKey: 'acme' } });
  assert.equal(result.status, 415);
});

test('add-provider forwards a valid body', async () => {
  const calls = [];
  const { routes } = makeContext({
    setup: {
      async addProvider(body) {
        calls.push(body);
        return { ok: true, routeId: body.routeId };
      },
    },
  });
  const route = routes.find((entry) => entry.path === '/dsh-free-models/add-provider');
  const result = await request(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { providerKey: 'acme', routeId: 'acme' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.json.ok, true);
  assert.equal(calls.length, 1);
});

test('same-origin check rejects a foreign origin', async () => {
  const { routes } = makeContext();
  const route = routes.find((entry) => entry.path === '/dsh-free-models/catalog');
  const result = await request(route, { headers: { origin: 'https://evil.example' } });
  assert.equal(result.status, 403);
});

test('unknown methods get 405 with an Allow header', async () => {
  const { routes } = makeContext();
  const route = routes.find((entry) => entry.path === '/dsh-free-models/catalog');
  const result = await request(route, { method: 'POST' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.allow, 'GET');
});

test('set-key rejects an unknown credential reference', async () => {
  const { routes } = makeContext();
  const route = routes.find((entry) => entry.path === '/dsh-free-models/set-key');
  const result = await request(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { ref: 'UNKNOWN_API_KEY', key: 'sk-test' },
  });
  assert.equal(result.status, 400);
  assert.equal(result.json.code, 'UNKNOWN_CREDENTIAL_REF');
});

test('deep-search returns web sources from ctx.web', async () => {
  const { routes } = makeContext({
    services: {
      web: {
        async search() {
          return { sources: [{ url: 'https://example.com', title: 'Example', snippet: 'snippet' }], truncated: false };
        },
      },
    },
  });
  const route = routes.find((entry) => entry.path === '/dsh-free-models/deep-search');
  const result = await request(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { query: 'free llm api' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.sources[0].url, 'https://example.com/');
});
