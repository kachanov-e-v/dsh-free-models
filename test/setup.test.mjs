import assert from 'node:assert/strict';
import test from 'node:test';

import { SetupService } from '../lib/setup.js';

function provider(overrides = {}) {
  return {
    key: 'acme',
    name: 'Acme',
    displayName: 'Acme',
    routeId: 'acme',
    api: 'openai-completions',
    baseURL: 'https://acme.example/v1',
    apiKeyEnv: 'ACME_API_KEY',
    apiKeyEnvAliases: [],
    freeKind: 'zero_price',
    addable: true,
    installedCatalog: false,
    models: [{
      id: 'free',
      name: 'Free',
      contextWindow: 1000,
      maxTokens: 100,
      input: ['text'],
      freeKind: 'zero_price',
    }],
    ...overrides,
  };
}

function setupHarness({ catalogProvider = provider(), initialProviders = {}, stream, installed = [] } = {}) {
  const updates = [];
  const storedKeys = new Map();
  let activeRoutes = [];
  const settingsState = { providers: { ...initialProviders } };
  const settings = {
    writable: true,
    describe() {
      return [{
        ns: 'llm-pi-ai',
        revision: updates.length + 1,
        value: { providers: settingsState.providers },
      }];
    },
    async update(ns, patch, revision) {
      updates.push({ ns, patch, revision });
      settingsState.providers = { ...settingsState.providers, ...(patch.providers ?? {}) };
      const routeId = Object.keys(patch.providers ?? {})[0];
      if (routeId) activeRoutes = [{ id: routeId, displayName: routeId, baseURL: null, models: [] }];
    },
  };
  const credentials = {
    async describe(ref) {
      return { configured: storedKeys.has(ref), writable: true, source: storedKeys.has(ref) ? 'stored' : undefined };
    },
    async set(ref, value) {
      storedKeys.set(ref, value);
    },
  };
  const llm = {
    listConfigurableProviders() {
      return installed;
    },
    listProviders() {
      return activeRoutes;
    },
    async *stream() {
      if (stream) return yield* stream();
      yield { type: 'text-delta', text: 'OK' };
      yield { type: 'finish', reason: { kind: 'stop' } };
    },
    async discoverModels() {
      return [{ id: 'discovered', name: 'Discovered', contextWindow: 2000, maxTokens: 200, inputModalities: ['text'] }];
    },
  };
  const ctx = {
    get(name) {
      if (name === 'settings') return settings;
      if (name === 'credentials') return credentials;
      if (name === 'llm') return llm;
      throw new Error(`missing service ${name}`);
    },
  };
  const catalog = {
    async snapshot() {
      return { providers: [catalogProvider] };
    },
  };
  return {
    setup: new SetupService({ ctx, catalog, collectState: undefined }),
    updates,
    storedKeys,
    settingsState,
    setActive: (routes) => { activeRoutes = routes; },
    llm,
  };
}

test('adds a provider, stores the key and runs one test request', async () => {
  const harness = setupHarness();
  const result = await harness.setup.addProvider({
    providerKey: 'acme',
    routeId: 'acme',
    modelIds: ['free'],
    apiKey: 'sk-sentinel-value',
    test: true,
    testModelId: 'free',
  });
  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(harness.updates.length, 1);
  assert.equal(harness.updates[0].ns, 'llm-pi-ai');
  assert.equal(harness.storedKeys.get('ACME_API_KEY'), 'sk-sentinel-value');
  assert.equal(result.test.ok, true);
  assert.equal(JSON.stringify(result).includes('sk-sentinel-value'), false);
});

test('does not write settings when the existing route has a different endpoint', async () => {
  const harness = setupHarness({
    initialProviders: {
      acme: {
        displayName: 'Acme',
        api: 'openai-completions',
        baseURL: 'https://other.example/v1',
        models: [],
      },
    },
  });
  const result = await harness.setup.addProvider({
    providerKey: 'acme',
    routeId: 'acme',
    modelIds: ['free'],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROUTE_CONFLICT');
  assert.equal(harness.updates.length, 0);
});

test('installed catalog providers can be added without a model list', async () => {
  const catalogProvider = provider({ api: null, baseURL: null, installedCatalog: true });
  const harness = setupHarness({
    catalogProvider,
    installed: [{
      provider: 'acme',
      displayName: 'Acme',
      declared: false,
      defaultBaseURL: 'https://catalog.example/v1',
    }],
  });
  const result = await harness.setup.addProvider({
    providerKey: 'acme',
    routeId: 'acme',
    modelIds: [],
    test: true,
    testModelId: 'free',
  });
  assert.equal(result.ok, true);
  assert.equal(result.profile.models, undefined);
  assert.equal(harness.updates[0].patch.providers.acme.baseURL, undefined);
});

test('rejects an arbitrary credential reference', async () => {
  const harness = setupHarness();
  const result = await harness.setup.setCredential({
    ref: 'DEEPSEEK_API_KEY',
    key: 'not-allowed',
    allowedRefs: new Set(['ACME_API_KEY']),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_CREDENTIAL_REF');
});

test('maps provider test failures to a stable code', async () => {
  const harness = setupHarness({
    stream: async function* streamFailure() {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: { code: 'QUOTA', message: 'quota exhausted' },
        },
      };
    },
  });
  harness.setActive([{ id: 'acme', displayName: 'Acme', models: [] }]);
  const result = await harness.setup.testModel({ provider: 'acme', model: 'free' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUOTA');
});

test('rate-limits repeated tests of the same model', async () => {
  const harness = setupHarness();
  harness.setActive([{ id: 'acme', displayName: 'Acme', models: [] }]);
  const first = await harness.setup.testModel({ provider: 'acme', model: 'free' });
  assert.equal(first.ok, true);
  const second = await harness.setup.testModel({ provider: 'acme', model: 'free' });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'TEST_TOO_FREQUENT');
});

test('discovers models through the llm service', async () => {
  const harness = setupHarness();
  const result = await harness.setup.discoverModels({ provider: 'acme' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.models.map((model) => model.id), ['discovered']);
});
