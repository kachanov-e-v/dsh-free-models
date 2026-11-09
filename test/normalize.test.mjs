import assert from 'node:assert/strict';
import test from 'node:test';

import * as openrouter from '../lib/sources/openrouter.js';
import * as kilo from '../lib/sources/kilo.js';
import * as vercel from '../lib/sources/vercel.js';
import * as modelsdev from '../lib/sources/modelsdev.js';
import { normalizeCurated } from '../lib/sources/curated.js';
import { finalizeProviders, mergeProviderRecords } from '../lib/normalize.js';

const fetchedAt = '2026-11-09T12:00:00.000Z';

test('OpenRouter keeps only zero-price chat models', () => {
  const result = openrouter.normalize({
    data: [
      {
        id: 'free/model:free',
        name: 'Free Model',
        context_length: 262144,
        top_provider: { max_completion_tokens: 8192 },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'paid/model',
        name: 'Paid Model',
        context_length: 1000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0.000001', completion: '0.000002' },
      },
      {
        id: 'embed/model',
        name: 'Embedding',
        context_length: 1000,
        architecture: { input_modalities: ['text'], output_modalities: ['embedding'] },
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'audio/model',
        name: 'Music',
        context_length: 1000,
        architecture: { input_modalities: ['text'], output_modalities: ['text', 'audio'] },
        pricing: { prompt: '0', completion: '0' },
      },
    ],
  }, fetchedAt);
  assert.equal(result.modelCount, 1);
  assert.equal(result.providers[0].models[0].id, 'free/model:free');
  assert.equal(result.providers[0].freeKind, 'zero_price');
  assert.equal(result.providers[0].api, 'openai-completions');
});

test('Kilo ignores the negative sentinel price and keeps explicit zero', () => {
  const result = kilo.normalize({
    data: [
      {
        id: 'kilo-auto/free',
        name: 'Auto Free',
        context_length: 256000,
        top_provider: { max_completion_tokens: 32768 },
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'kilo-auto/efficient',
        name: 'Auto Efficient',
        context_length: 1000000,
        architecture: { input_modalities: ['text'], output_modalities: ['text'] },
        pricing: { prompt: '-1', completion: '-1' },
      },
    ],
  }, fetchedAt);
  assert.equal(result.modelCount, 1);
  assert.equal(result.providers[0].models[0].id, 'kilo-auto/free');
});

test('Vercel detects the -free suffix via zero pricing and filters non-language rows', () => {
  const result = vercel.normalize({
    data: [
      {
        id: 'vendor/model-free',
        name: 'Free',
        context_window: 1000000,
        max_tokens: 32000,
        type: 'language',
        pricing: { input: '0', output: '0' },
      },
      {
        id: 'vendor/embedding',
        name: 'Embedding',
        type: 'embedding',
        pricing: { input: '0', output: '0' },
      },
    ],
  }, fetchedAt);
  assert.equal(result.modelCount, 1);
  assert.equal(result.providers[0].models[0].id, 'vendor/model-free');
});

test('models.dev records start unverified and keep paid models for curated providers', () => {
  const result = modelsdev.normalize({
    acme: {
      id: 'acme',
      name: 'Acme',
      env: ['ACME_API_KEY'],
      npm: '@ai-sdk/openai-compatible',
      doc: 'https://acme.example/docs',
      api: 'https://acme.example/v1',
      models: {
        free: {
          id: 'free',
          name: 'Free',
          modalities: { input: ['text'], output: ['text'] },
          limit: { context: 1000, output: 100 },
          cost: { input: 0, output: 0 },
        },
        paid: {
          id: 'paid',
          name: 'Paid',
          modalities: { input: ['text'], output: ['text'] },
          limit: { context: 2000, output: 200 },
          cost: { input: 1, output: 2 },
        },
        embed: {
          id: 'embed',
          type: 'embedding',
          modalities: { input: ['text'], output: ['text'] },
          cost: { input: 0, output: 0 },
        },
        whisper: {
          id: 'whisper',
          name: 'Whisper',
          type: 'transcription',
          modalities: { input: ['audio'], output: ['text'] },
          cost: { input: 0, output: 0 },
        },
        guard: {
          id: 'guard',
          name: 'Prompt Guard',
          modalities: { input: ['text'], output: ['text'] },
          cost: { input: 0, output: 0 },
        },
      },
    },
  }, fetchedAt);
  const provider = result.providers[0];
  assert.equal(provider.api, 'openai-completions');
  assert.equal(provider.apiKeyEnv, 'ACME_API_KEY');
  assert.equal(provider.freeKind, 'unverified');
  assert.deepEqual(provider.models.map((model) => model.id), ['free', 'paid']);
});

test('curated registry accepts a valid entry and rejects an undocumented one', () => {
  const result = normalizeCurated({
    schemaVersion: 1,
    providers: [
      {
        key: 'good',
        name: 'Good',
        routeId: 'good',
        freeKind: 'free_tier',
        freeNote: 'Free tier',
        docsURL: 'https://good.example/docs',
        verifiedAt: '2026-11-09',
        sources: ['https://good.example/docs'],
      },
      {
        key: 'bad',
        name: 'Bad',
        routeId: 'bad',
        freeKind: 'free_tier',
        sources: [],
      },
    ],
  }, fetchedAt);
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].key, 'good');
  assert.ok(result.warnings.some((warning) => warning.includes('sources')));
});

test('free models survive a large paid catalog that appears before the live source', () => {
  const paid = Array.from({ length: 60 }, (_, index) => ({
    id: `vendor/paid-${index}`,
    name: `Paid ${index}`,
    contextWindow: 1000,
    maxTokens: 100,
    input: ['text'],
    freeKind: 'paid',
    evidence: [],
  }));
  const free = {
    id: 'vendor/free',
    name: 'Free',
    contextWindow: 1000,
    maxTokens: 100,
    input: ['text'],
    freeKind: 'zero_price',
    evidence: [],
  };
  const merged = mergeProviderRecords([
    {
      key: 'acme',
      name: 'Acme',
      displayName: 'Acme',
      routeId: 'acme',
      api: 'openai-completions',
      baseURL: 'https://acme.example/v1',
      apiKeyEnv: 'ACME_API_KEY',
      freeKind: 'unverified',
      models: paid,
      evidence: [],
    },
    {
      key: 'acme',
      name: 'Acme',
      displayName: 'Acme',
      routeId: 'acme',
      api: 'openai-completions',
      baseURL: 'https://acme.example/v1',
      apiKeyEnv: 'ACME_API_KEY',
      freeKind: 'zero_price',
      models: [free],
      evidence: [],
    },
  ], { maxModelsPerProvider: 200 });
  const finalized = finalizeProviders(merged, { maxModelsPerProvider: 50 });
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].freeKind, 'zero_price');
  assert.deepEqual(finalized[0].models.map((model) => model.id), ['vendor/free']);
});

test('unverified providers are hidden by default and shown on request', () => {
  const merged = mergeProviderRecords([{
    key: 'acme',
    name: 'Acme',
    displayName: 'Acme',
    routeId: 'acme',
    api: null,
    baseURL: null,
    apiKeyEnv: null,
    freeKind: 'unverified',
    models: [{
      id: 'free',
      name: 'Free',
      contextWindow: 1000,
      maxTokens: 100,
      input: ['text'],
      freeKind: 'unverified',
      evidence: [],
    }],
    evidence: [],
  }]);
  assert.equal(finalizeProviders(merged, {}).length, 0);
  assert.equal(finalizeProviders(merged, { includeUnverified: true }).length, 1);
});
