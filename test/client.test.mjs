import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

let captured;
globalThis.window = {
  __DSH_FREE_MODELS_TEST__: true,
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
};
globalThis.__DSH_FREE_MODELS_TEST__ = true;

const reactStub = {
  createElement(type, props, ...children) {
    return { type, props, children };
  },
  Fragment: Symbol('Fragment'),
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {},
  useMemo(fn) {
    return fn();
  },
  useCallback(fn) {
    return fn;
  },
};

await import(`${pathToFileURL(resolve('client.js')).href}?test=${Date.now()}`);
assert.ok(captured, 'client module registers through the module loader');
const client = captured.factory((id) => {
  if (id === 'react') return reactStub;
  throw new Error(`unexpected require: ${id}`);
});
assert.ok(client.__test, 'test hooks must be exposed under the test flag');
const helpers = client.__test;

test('filterProviders matches provider and model text', () => {
  const providers = [
    { key: 'openrouter', name: 'OpenRouter', displayName: 'OpenRouter', freeKind: 'zero_price', api: 'openai-completions', models: [{ id: 'nvidia/free', name: 'Nvidia Free' }] },
    { key: 'groq', name: 'Groq', displayName: 'Groq', freeKind: 'free_tier', api: 'openai-completions', models: [] },
    { key: 'local', name: 'Local', displayName: 'Local', freeKind: 'local', api: 'openai-completions', configured: true, models: [] },
  ];
  assert.equal(helpers.filterProviders(providers, { query: 'nvidia' }).length, 1);
  assert.equal(helpers.filterProviders(providers, { kind: 'free_tier' }).length, 1);
  assert.equal(helpers.filterProviders(providers, { configuredOnly: true }).length, 1);
  assert.equal(helpers.filterProviders(providers, { api: 'anthropic-messages' }).length, 0);
});

test('formatContext uses compact decimal units', () => {
  assert.equal(helpers.formatContext(262144), '262K');
  assert.equal(helpers.formatContext(1_000_000), '1M');
  assert.equal(helpers.formatContext(null), '—');
});

test('route id validation is strict', () => {
  assert.equal(helpers.validateRouteId('openrouter-free'), null);
  assert.notEqual(helpers.validateRouteId('Bad Route'), null);
  assert.notEqual(helpers.validateRouteId('-bad'), null);
});

test('kindLabel reads the dictionary', () => {
  const t = (key) => helpers.en[key] ?? key;
  assert.equal(helpers.kindLabel('zero_price', t), 'Zero price');
  assert.equal(helpers.kindLabel('free_tier', t), 'Free tier');
});

test('English and Russian dictionaries have the same keys', () => {
  assert.deepEqual(Object.keys(helpers.en).sort(), Object.keys(helpers.ru).sort());
});

test('the main components render without throwing with an empty catalog', () => {
  const t = (key) => helpers.en[key] ?? key;
  const provider = {
    key: 'openrouter',
    name: 'OpenRouter',
    displayName: 'OpenRouter',
    routeId: 'openrouter',
    api: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    freeKind: 'zero_price',
    freeNote: 'Zero-price models',
    models: [{ id: 'free/model', name: 'Free', contextWindow: 1000, maxTokens: 100, input: ['text'], freeKind: 'zero_price' }],
    evidence: [],
    addable: true,
    configured: false,
  };
  const section = helpers.FreeModelsSection({ t });
  assert.ok(section);
  const card = helpers.ProviderCard({ provider, t, configured: false, onSetup() {}, onConfig() {} });
  assert.ok(card);
  const panel = helpers.SetupPanel({
    provider,
    dsh: {
      settings: { available: true, writable: true, revision: 1 },
      configured: [],
      installed: [],
    },
    t,
    onClose() {},
    onChanged() {},
  });
  assert.ok(panel);
  const deep = helpers.DeepSearch({ t });
  assert.ok(deep);
});

test('apply registers the settings section and the locale bundle', () => {
  const localeRegistrations = [];
  const slotRegistrations = [];
  const injections = [];
  const ctx = {
    locale: {
      bind: () => (key) => helpers.en[key] ?? key,
      register: (ns, dictionaries) => {
        localeRegistrations.push({ ns, dictionaries });
        return () => {};
      },
    },
    slots: {
      inject: (name, register) => {
        injections.push(name);
        return register();
      },
      register: (options, component) => {
        slotRegistrations.push({ options, component });
        return () => {};
      },
    },
    effect: (fn) => fn(),
  };
  client.apply(ctx);
  assert.deepEqual(injections, ['settings.section']);
  assert.equal(localeRegistrations.length, 1);
  assert.equal(localeRegistrations[0].ns, 'freeModels');
  assert.ok(localeRegistrations[0].dictionaries.en);
  assert.ok(localeRegistrations[0].dictionaries.ru);
  assert.equal(slotRegistrations.length, 1);
  assert.equal(slotRegistrations[0].options.id, 'free-models');
  assert.equal(slotRegistrations[0].options.order, 12);
  assert.equal(slotRegistrations[0].options.name, 'settings.section');
  assert.equal(slotRegistrations[0].options.label(), 'Free models');
});


