import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyExistingProvider,
  buildProviderProfile,
  mergeModels,
  providerConfigFragment,
  toYaml,
} from '../lib/config.js';

function provider(overrides = {}) {
  return {
    key: 'acme',
    name: 'Acme',
    displayName: 'Acme Gateway',
    routeId: 'acme',
    api: 'openai-completions',
    baseURL: 'https://acme.example/v1',
    apiKeyEnv: 'ACME_API_KEY',
    freeKind: 'zero_price',
    models: [{
      id: 'vendor/model:free',
      name: 'Vendor Model',
      contextWindow: 262144,
      maxTokens: 8192,
      input: ['text', 'image'],
      freeKind: 'zero_price',
    }],
    ...overrides,
  };
}

test('builds a hand-declared profile with selected models', () => {
  const built = buildProviderProfile(provider(), {
    routeId: 'acme-free',
    modelIds: ['vendor/model:free'],
    dshState: { installed: [] },
  });
  assert.equal(built.ok, true);
  assert.equal(built.declared, true);
  assert.equal(built.profile.api, 'openai-completions');
  assert.equal(built.profile.baseURL, 'https://acme.example/v1');
  assert.equal(built.profile.apiKeyEnv, 'ACME_API_KEY');
  assert.deepEqual(built.profile.models.map((model) => model.id), ['vendor/model:free']);
});

test('installed catalog routes do not need a model list or endpoint override', () => {
  const built = buildProviderProfile(provider({ api: null, baseURL: null }), {
    routeId: 'acme',
    modelIds: [],
    dshState: {
      installed: [{ provider: 'acme', displayName: 'Acme', declared: false, defaultBaseURL: 'https://catalog.example/v1' }],
    },
  });
  assert.equal(built.ok, true);
  assert.equal(built.declared, false);
  assert.equal(built.installedCatalog, true);
  assert.equal(built.profile.api, undefined);
  assert.equal(built.profile.baseURL, undefined);
  assert.equal(built.profile.models, undefined);
});

test('rejects invalid route ids, unknown models and missing models for hand-declared routes', () => {
  assert.equal(buildProviderProfile(provider(), { routeId: 'Bad Route', modelIds: [], dshState: { installed: [] } }).ok, false);
  assert.equal(buildProviderProfile(provider(), { routeId: 'acme', modelIds: ['missing'], dshState: { installed: [] } }).code, 'UNKNOWN_MODEL');
  assert.equal(buildProviderProfile(provider(), { routeId: 'acme', modelIds: [], dshState: { installed: [] } }).code, 'MODEL_REQUIRED');
});

test('a custom route id on an installed catalog provider is hand-declared', () => {
  const built = buildProviderProfile(provider(), {
    routeId: 'acme-custom',
    modelIds: ['vendor/model:free'],
    dshState: {
      installed: [{ provider: 'acme', displayName: 'Acme', declared: false, defaultBaseURL: 'https://catalog.example/v1' }],
    },
  });
  assert.equal(built.ok, true);
  assert.equal(built.declared, true);
  assert.equal(built.profile.api, 'openai-completions');
  assert.equal(built.profile.baseURL, 'https://acme.example/v1');
});

test('merges existing models without replacing them', () => {
  const current = {
    displayName: 'My Acme',
    api: 'openai-completions',
    baseURL: 'https://acme.example/v1',
    apiKeyEnv: 'ACME_API_KEY',
    models: [{ id: 'old', name: 'Old', contextWindow: 1000 }],
  };
  const applied = applyExistingProvider({
    displayName: 'Acme Gateway',
    api: 'openai-completions',
    baseURL: 'https://acme.example/v1',
    apiKeyEnv: 'ACME_API_KEY',
    models: [{ id: 'new', name: 'New', contextWindow: 2000 }],
  }, { current, merge: true });
  assert.equal(applied.ok, true);
  assert.equal(applied.profile.displayName, 'My Acme');
  assert.deepEqual(applied.profile.models.map((model) => model.id), ['old', 'new']);
});

test('rejects a route whose existing endpoint differs', () => {
  const applied = applyExistingProvider({
    api: 'openai-completions',
    baseURL: 'https://other.example/v1',
  }, {
    current: { api: 'openai-completions', baseURL: 'https://acme.example/v1' },
    merge: true,
  });
  assert.equal(applied.ok, false);
  assert.equal(applied.code, 'ROUTE_CONFLICT');
});

test('renders valid YAML for ids and names with punctuation', () => {
  const fragment = providerConfigFragment(provider({
    displayName: 'Acme # Free',
  }), {
    routeId: 'acme-free',
    modelIds: ['vendor/model:free'],
    dshState: { installed: [] },
  });
  assert.equal(fragment.ok, true);
  const yaml = fragment.yaml;
  assert.match(yaml, /providers:/);
  assert.match(yaml, /acme-free:/);
  assert.match(yaml, /vendor\/model:free/);
  assert.match(yaml, /"Acme # Free"/);
  assert.ok(yaml.endsWith('\n'));
});

test('toYaml keeps arrays of scalars as a block list', () => {
  const text = toYaml({ input: ['text', 'image'] });
  assert.equal(text, 'input:\n  - text\n  - image\n');
});

test('mergeModels deduplicates by id and preserves the existing entry', () => {
  const merged = mergeModels([{ id: 'a', name: 'Old' }], [{ id: 'a', name: 'New' }, { id: 'b', name: 'B' }]);
  assert.deepEqual(merged.map((model) => model.id), ['a', 'b']);
  assert.equal(merged[0].name, 'Old');
});

test('mergeModels removes empty or unsupported input arrays from an existing entry', () => {
  const merged = mergeModels([{ id: 'a', input: [] }, { id: 'b', input: ['audio', 'video'] }], []);
  assert.equal('input' in merged[0], false);
  assert.equal('input' in merged[1], false);
});

test('drops input modalities the llm-pi-ai schema does not accept', () => {
  const built = buildProviderProfile(provider({
    models: [{
      id: 'vendor/multimodal',
      name: 'Multimodal',
      contextWindow: 1000,
      maxTokens: 100,
      input: ['text', 'image', 'video', 'file', 'audio'],
      freeKind: 'zero_price',
    }],
  }), {
    routeId: 'acme',
    modelIds: ['vendor/multimodal'],
    dshState: { installed: [] },
  });
  assert.equal(built.ok, true);
  assert.deepEqual(built.profile.models[0].input, ['text', 'image']);
});

