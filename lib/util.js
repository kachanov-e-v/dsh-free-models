/**
 * Small shared helpers for the host half.
 *
 * Security-relevant rules live here on purpose: URL validation, API-key
 * validation, bounded error text, and the one place that talks to the network
 * for public catalogs. Nothing here reads or logs a secret.
 */

export class SourceError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'SourceError';
    this.code = code;
  }
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function clampInt(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

export function nowIso(clock = Date.now) {
  return new Date(clock()).toISOString();
}

export function isoDate(value) {
  const text = typeof value === 'string' ? value : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return text;
}

export function isOlderThanDays(isoDay, days, clock = Date.now) {
  const day = isoDate(isoDay);
  if (day === null) return true;
  const then = new Date(`${day}T00:00:00Z`).getTime();
  return clock() - then > days * 24 * 60 * 60 * 1000;
}

export function isZeroPrice(value) {
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  const number = Number(trimmed);
  return Number.isFinite(number) && number === 0;
}

export function truncate(value, max) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function oneLine(value, max = 240) {
  return truncate(String(value ?? '').replace(/\s+/gu, ' ').trim(), max);
}

export function dedupeBy(items, keyOf) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyOf(item);
    if (key === undefined || key === null || key === '') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

export function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

export function timeoutSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(1, timeoutMs));
  if (signal === undefined) return timeout;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeout]);
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason ?? timeout.reason);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', () => controller.abort(timeout.reason), { once: true });
  return controller.signal;
}

const MAX_CATALOG_BYTES = 24 * 1024 * 1024;

/**
 * Fetch one public JSON document. No credentials, no cookies, no retries:
 * a source failure is contained by CatalogService.
 */
export async function fetchJson(url, { timeoutMs = 15000, signal } = {}) {
  const parsed = safeHttpUrl(url);
  if (parsed === null) throw new SourceError('BAD_URL', 'catalog URL must be an https URL');
  const combined = timeoutSignal(signal, timeoutMs);
  let response;
  try {
    response = await fetch(parsed.href, {
      method: 'GET',
      redirect: 'follow',
      signal: combined,
      headers: {
        accept: 'application/json',
        'user-agent': 'dsh-free-models/0.1 (+https://github.com/kachanov-e-v/dsh-free-models)',
      },
    });
  } catch (error) {
    if (combined.aborted) throw new SourceError('TIMEOUT', `request to ${parsed.host} timed out`);
    throw new SourceError('NETWORK', `could not reach ${parsed.host}`);
  }
  if (!response.ok) {
    throw new SourceError('HTTP_ERROR', `${parsed.host} answered HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length > MAX_CATALOG_BYTES) {
    throw new SourceError('PAYLOAD_TOO_LARGE', `${parsed.host} answered more than ${MAX_CATALOG_BYTES} bytes`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new SourceError('BAD_PAYLOAD', `${parsed.host} did not answer JSON`);
  }
}

export function safeHttpUrl(value, { allowLocalhost = false } = {}) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && allowLocalhost) {
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return url;
  }
  return null;
}

export function validateRouteId(value) {
  if (typeof value !== 'string') return 'Route id must be a string';
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(value)) {
    return 'Route id must start with a lowercase letter and contain only a-z, 0-9 and hyphens (max 64)';
  }
  return null;
}

export function validateEnvName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value)) {
    return 'Credential reference must look like an environment variable name';
  }
  return null;
}

export function validateModelId(value) {
  if (typeof value !== 'string') return 'Model id must be a string';
  if (value.length === 0 || value.length > 256) return 'Model id must be 1-256 characters';
  if (/[\u0000-\u001f\u007f]/u.test(value)) return 'Model id contains control characters';
  return null;
}

/**
 * The harness validates an API key as an HTTP header value: printable ASCII,
 * no whitespace, no line breaks. Keep the same rule before storing it.
 */
export function normalizeApiKey(value) {
  if (typeof value !== 'string') return { ok: false, reason: 'API key must be a string' };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: false, reason: 'API key is empty' };
  if (trimmed.length > 4096) return { ok: false, reason: 'API key is too long' };
  if (!/^[\x21-\x7e]+$/.test(trimmed)) {
    return { ok: false, reason: 'API key contains characters an HTTP header cannot carry' };
  }
  return { ok: true, value: trimmed };
}

export function errorInfo(error, fallbackCode = 'ERROR') {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code)
    ? error.code
    : fallbackCode;
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed';
  return {
    code,
    message: truncate(oneLine(raw, 280), 280),
  };
}

export function formatContextWindow(value) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(0)}K`;
  }
  return String(value);
}

export function isChatModel(model, text = []) {
  if (!isRecord(model)) return false;
  const modalities = isRecord(model.modalities) ? model.modalities : model.architecture;
  const output = Array.isArray(modalities?.output)
    ? modalities.output
    : Array.isArray(modalities?.output_modalities) ? modalities.output_modalities : text;
  if (Array.isArray(output) && output.length > 0) {
    if (!output.includes('text')) return false;
    // Audio-output models such as music/speech generators are not chat models.
    if (output.includes('audio')) return false;
  }
  const input = Array.isArray(modalities?.input)
    ? modalities.input
    : Array.isArray(modalities?.input_modalities) ? modalities.input_modalities : [];
  if (input.length > 0 && !input.includes('text')) return false;
  const type = String(model.type ?? '').toLowerCase();
  if (['embedding', 'image', 'audio', 'transcription', 'tts', 'speech', 'moderation', 'rerank', 'classifier'].includes(type)) {
    return false;
  }
  const label = `${model.id ?? ''} ${model.name ?? ''} ${model.family ?? ''}`.toLowerCase();
  if (/(prompt[- ]?guard|\bguard\b|moderation|whisper|transcrib|embedding|rerank|\btts\b)/u.test(label)) return false;
  if (model.status === 'deprecated') return false;
  return true;
}

const PACKAGE_HOSTS = new Set([
  'pypi.org',
  'npmjs.com',
  'www.npmjs.com',
  'crates.io',
  'pkg.go.dev',
  'rubygems.org',
  'packagist.org',
]);

/**
 * Keep deep-search results focused on provider/docs pages. Package registries
 * answer `free llm api` queries with libraries, not providers.
 */
export function filterWebSources(sources) {
  const output = [];
  const seen = new Set();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!isRecord(source) || typeof source.url !== 'string') continue;
    let parsed;
    try {
      parsed = new URL(source.url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
    if (PACKAGE_HOSTS.has(parsed.hostname)) continue;
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    output.push({
      url: parsed.href,
      title: typeof source.title === 'string' ? oneLine(source.title, 200) : '',
      snippet: typeof source.snippet === 'string' ? oneLine(source.snippet, 500) : '',
      ...(typeof source.publishedAt === 'string' ? { publishedAt: source.publishedAt } : {}),
    });
  }
  return output;
}
