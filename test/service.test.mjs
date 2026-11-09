import assert from 'node:assert/strict';
import test from 'node:test';

import { CatalogService } from '../lib/service.js';

function provider(key, modelId = 'model/free') {
  return {
    key,
    name: key,
    displayName: key,
    routeId: key,
    api: 'openai-completions',
    baseURL: `https://${key}.example/v1`,
    apiKeyEnv: `${key.toUpperCase()}_API_KEY`,
    apiKeyEnvAliases: [`${key.toUpperCase()}_ALT_KEY`],
    freeKind: 'zero_price',
    freeNote: 'free',
    models: [{
      id: modelId,
      name: modelId,
      contextWindow: 1000,
      maxTokens: 100,
      input: ['text'],
      freeKind: 'zero_price',
      evidence: [],
    }],
    evidence: [],
    warnings: [],
    sourceIds: [key],
  };
}

function fakeSource(id, value, { fail = false } = {}) {
  let calls = 0;
  return {
    id,
    label: id,
    timeoutMs: 1000,
    async fetchSource() {
      calls += 1;
      if (fail) throw new Error(`${id} failed`);
      return { providers: [value()], warnings: [] };
    },
    calls: () => calls,
  };
}

test('catalog service caches, coalesces and refreshes on force', async () => {
  let now = 0;
  const source = fakeSource('acme', () => provider('acme'));
  const service = new CatalogService({
    config: { sources: ['acme'], cacheTtlMinutes: 60 },
    sources: [source],
    clock: () => now,
  });
  const first = await service.snapshot({ dshState: { installed: [], active: [] } });
  assert.equal(first.counts.providers, 1);
  assert.equal(source.calls(), 1);
  now = 1000;
  await service.snapshot({ dshState: { installed: [], active: [] } });
  assert.equal(source.calls(), 1);
  await service.snapshot({ force: true, dshState: { installed: [], active: [] } });
  assert.equal(source.calls(), 2);
  service.dispose();
});

test('a failed source keeps its last good answer and is marked stale', async () => {
  let now = 0;
  let fail = false;
  const source = {
    id: 'acme',
    label: 'Acme',
    timeoutMs: 1000,
    async fetchSource() {
      if (fail) throw new Error('network down');
      return { providers: [provider('acme')], warnings: [] };
    },
  };
  const service = new CatalogService({
    config: { sources: ['acme'] },
    sources: [source],
    clock: () => now,
  });
  await service.snapshot({ dshState: { installed: [], active: [] } });
  fail = true;
  now = 60 * 60 * 1000;
  const snapshot = await service.snapshot({ force: true, dshState: { installed: [], active: [] } });
  assert.equal(snapshot.counts.providers, 1);
  assert.equal(snapshot.sources[0].status, 'stale');
  assert.equal(snapshot.stale, true);
  assert.ok(snapshot.warnings.some((warning) => warning.includes('stale')));
  service.dispose();
});

test('one source failing does not hide another source', async () => {
  const good = fakeSource('good', () => provider('good'));
  const bad = fakeSource('bad', () => provider('bad'), { fail: true });
  const service = new CatalogService({
    config: { sources: ['good', 'bad'] },
    sources: [good, bad],
    clock: () => 0,
  });
  const snapshot = await service.snapshot({ dshState: { installed: [], active: [] } });
  assert.equal(snapshot.counts.providers, 1);
  assert.equal(snapshot.providers[0].key, 'good');
  assert.equal(snapshot.sources.find((source) => source.id === 'bad').status, 'error');
  service.dispose();
});

test('search filters by query, kind, api and configured only', async () => {
  const source = fakeSource('acme', () => provider('acme'));
  const service = new CatalogService({
    config: { sources: ['acme'] },
    sources: [source],
    clock: () => 0,
  });
  const dshState = {
    installed: [],
    active: [{ routeId: 'acme', displayName: 'Acme', models: [] }],
    capabilities: { llm: true },
  };
  const found = await service.search({ query: 'acme', kind: 'zero_price', dshState });
  assert.equal(found.providers.length, 1);
  const missing = await service.search({ query: 'other', dshState });
  assert.equal(missing.providers.length, 0);
  const configured = await service.search({ configuredOnly: true, dshState });
  assert.equal(configured.providers.length, 1);
  service.dispose();
});

test('matches a configured route through an apiKeyEnv alias', async () => {
  const source = fakeSource('acme', () => provider('acme'));
  const service = new CatalogService({
    config: { sources: ['acme'] },
    sources: [source],
    clock: () => 0,
  });
  const dshState = {
    installed: [],
    active: [],
    settings: {
      providers: {
        'my-acme-route': { apiKeyEnv: 'ACME_ALT_KEY' },
      },
    },
    capabilities: {},
  };
  const snapshot = await service.snapshot({ dshState });
  const entry = snapshot.providers[0];
  assert.equal(entry.configured, true);
  assert.equal(entry.configuredRouteId, 'my-acme-route');
  service.dispose();
});

