import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterWebSources,
  isZeroPrice,
  normalizeApiKey,
  validateEnvName,
  validateRouteId,
} from '../lib/util.js';

test('filterWebSources removes package registries and duplicates', () => {
  const sources = filterWebSources([
    { url: 'https://pypi.org/project/freelm/', title: 'pypi' },
    { url: 'https://github.com/nejib1/Free-LLM', title: 'Free LLM' },
    { url: 'https://github.com/nejib1/Free-LLM', title: 'Duplicate' },
    { url: 'ftp://example.com/file', title: 'FTP' },
    { url: 'https://docs.example.com/free', title: 'Docs', snippet: 'Free tier' },
  ]);
  assert.deepEqual(sources.map((source) => source.url), [
    'https://github.com/nejib1/Free-LLM',
    'https://docs.example.com/free',
  ]);
  assert.equal(sources[0].title, 'Free LLM');
});

test('zero price accepts numeric and string zero only', () => {
  assert.equal(isZeroPrice('0'), true);
  assert.equal(isZeroPrice(0), true);
  assert.equal(isZeroPrice('0.0'), true);
  assert.equal(isZeroPrice('-1'), false);
  assert.equal(isZeroPrice(''), false);
  assert.equal(isZeroPrice(null), false);
});

test('credential and route validation reject unsafe shapes', () => {
  assert.equal(normalizeApiKey('  sk-abc  ').value, 'sk-abc');
  assert.equal(normalizeApiKey('sk abc').ok, false);
  assert.equal(normalizeApiKey('sk\nabc').ok, false);
  assert.equal(validateEnvName('OPENROUTER_API_KEY'), null);
  assert.notEqual(validateEnvName('openrouter-key'), null);
  assert.equal(validateRouteId('vercel-ai-gateway'), null);
  assert.notEqual(validateRouteId('Vercel'), null);
});
