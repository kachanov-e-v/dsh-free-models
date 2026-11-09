# Архитектура

Документ описывает внутреннее устройство `dsh-free-models` и контракты,
которые нельзя ломать без обновления тестов и README.

## Цели и ограничения

Плагин должен:

1. Находить провайдеров и модели с нулевой ценой или документированным free tier.
2. Показывать каталог в Settings и давать агенту read-only инструменты.
3. Уметь по явному подтверждению добавить/объединить провайдера в `llm-pi-ai`,
   сохранить ключ и отправить один тестовый запрос.
4. Не выдумывать факты, не скрывать источник и дату проверки.
5. Не раскрывать ключи и не принимать произвольные endpoint’ы от клиента.
6. Деградировать по источникам независимо: один сбой не скрывает остальные.

## Поток данных

```text
Settings page (client.js)                 Agent tools (lib/tools.js)
          │                                        │
          └───────────────┬────────────────────────┘
                          ▼
                 CatalogService (lib/service.js)
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                      ▼
  lib/sources/*      models.dev            data/providers.json
  openrouter          (6 MB JSON)          (курируемый реестр)
  kilo
  vercel
        │
        ▼
  mergeProviderRecords + finalizeProviders (lib/normalize.js)
        │
        ├── UI payload: providers, models, evidence, source status
        └── tool text: Markdown/JSON

  SetupService (lib/setup.js) ── только UI, по кнопке
        ├── ctx.settings.update('llm-pi-ai', patch, revision)
        ├── ctx.credentials.set(ref, key)
        ├── ctx.llm.discoverModels('llm-pi-ai', request, signal)
        └── ctx.llm.stream(...) — один тестовый запрос
```

## Host: источники

Каждый модуль `lib/sources/*` экспортирует:

```text
{
  id, label, url, timeoutMs,
  normalize(payload, fetchedAt) -> { providers[], warnings[], modelCount },
  fetchSource(fetchJson, signal) -> Promise<same>
}
```

`fetchJson` из `lib/util.js`:

- только `https` (для локальных провайдеров `http://localhost` разрешён в
  конфиге, но не для публичных каталогов);
- таймаут, `accept: application/json`, понятный `user-agent`;
- без cookies, ключей и session-данных;
- лимит размера ответа 24 MiB;
- ошибки классифицируются как `NETWORK`, `TIMEOUT`, `HTTP_ERROR`,
  `BAD_PAYLOAD`, `PAYLOAD_TOO_LARGE`.

### OpenRouter / Kilo / Vercel

- Берутся только чат-модели (output modalities содержит `text`).
- Нулевая цена: `pricing.prompt` и `pricing.completion` (OpenRouter/Kilo) или
  `pricing.input` и `pricing.output` (Vercel) равны 0; `request`/`image` также
  должны быть 0, если указаны.
- Отрицательная цена (`-1`, переменная) не считается бесплатной.
- `-free`/`:free` — подсказка, но решает цена.
- Записи помечаются `zero_price` и получают live evidence.

### models.dev

- Провайдеры и модели начинаются как `unverified`; cost 0 не равен free tier.
- Для курируемых провайдеров эти модели используются как каталог моделей, но
  классификация остаётся за курируемой записью.
- `api`/`npm` маппятся в поддерживаемый протокол только когда это безопасно;
  Google native API не выдаётся за OpenAI-compatible.

### Курируемый реестр

`data/providers.json`:

- `schemaVersion: 1`, массив `providers`;
- обязательные `key`, `name`, `freeKind`, `docsURL`, `verifiedAt`, `sources[]`;
- `api`, `baseURL`, `apiKeyEnv` — необязательные;
- `apiKeyEnvAliases` — альтернативные имена переменных;
- `freeKind`: `free_tier`, `trial`, `local`;
- запись без источника или с невалидным полем пропускается с предупреждением;
- дата старше 180 дней даёт предупреждение.

## Host: merge и фильтрация

`mergeProviderRecords` объединяет записи по `key`:

- первый непустой `apiKeyEnv`, `baseURL`, `displayName`, `docsURL` побеждает;
- `freeKind` берётся по силе: `zero_price` > `free_tier` > `trial` > `local` >
  `unverified`;
- `curatedKind` сохраняется отдельно, чтобы curated free tier не терялся при
  слиянии с live-записью;
- модели дедуплицируются по `id`; live-поля (контекст, max tokens, input)
  приоритетнее models.dev; evidence объединяется;
- лимит моделей применяется в `finalizeProviders`, а не до слияния, иначе
  бесплатные модели могли бы быть вытеснены большим платным каталогом.

`finalizeProviders`:

- `zero_price`: оставить только zero-price модели;
- `free_tier`: оставить каталог моделей провайдера и пометить их `free_tier`;
- `trial`: скрыть, если `includeTrialCredits !== true`;
- `local`: показать;
- `unverified`: скрыть, если `includeUnverified !== true`;
- `addable`: true для installed catalog или при известных `api` + `baseURL`;
- сортировка: тип, configured, число моделей, имя.

`enrichWithDsh`:

- находит `llm-pi-ai` directory entry по provider key/routeId;
- для installed catalog (`declared: false`) не требует `api`/`baseURL` и
  помечает `installedCatalog: true`;
- находит активный маршрут по routeId или baseURL, а профиль — по routeId или
  `apiKeyEnv`/алиасу (например, `vercel-ai-gateway` с
  `VERCEL_AI_GATEWAY_API_KEY`), ставит `configured: true` и
  `configuredRouteId`;
- добавляет `addBlockReason`, если автоматическое добавление невозможно.

## Host: кэш и отказы

`CatalogService`:

- TTL по умолчанию 720 минут (5..1440);
- `rawSnapshot({force})` возвращает кэш или запускает refresh;
- одновременные refresh коалесцируются;
- `lastGood` хранится по каждому источнику;
- при ошибке источник помечается `stale`, используются его last-good данные;
- если last-good нет — `error`, остальные источники продолжают работать;
- `stale: true`, если есть `stale`/`error` источник;
- `snapshot({dshState})` обогащает и финализирует данные;
- `search()` фильтрует по query/kind/api/minContext/configured и ограничивает
  число провайдеров;
- `dispose()` очищает кэш и last-good.

## Host: HTTP-контракты

Префикс `/dsh-free-models`.

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/catalog?refresh=1&unverified=1` | — | snapshot |
| GET | `/state` | — | capabilities, configured, settings, sources |
| POST | `/deep-search` | `{query, maxResults?}` | web sources |
| POST | `/config` | `{providerKey, routeId?, modelIds?}` | YAML/JSON fragment |
| POST | `/discover-models` | `{provider?, baseURL?, api?, apiKey?}` | candidate models |
| POST | `/add-provider` | `{providerKey, routeId, modelIds, apiKey?, useEnv?, test?, testModelId?, includeUnverified?}` | setup result |
| POST | `/set-key` | `{ref, key}` | `{ok, ref, configured}` |
| POST | `/test` | `{provider, model}` | test result |

Общие правила:

- same-origin через `connection.requestRejection` + Origin/Host;
- только заявленный метод;
- POST требует `content-type: application/json`;
- тело: 64 KiB для add, 8 KiB для остальных;
- ошибки — `{ok:false, code, message}` без стека и секретов;
- write-маршруты не логируют тело.

## Host: setup

`SetupService.addProvider`:

1. Валидирует `providerKey`, `routeId`, `modelIds`, `apiKey`, `apiKeyEnv`.
2. Собирает `collectDshState()`: directory, active routes, settings descriptor,
   credential statuses.
3. Проверяет `settings.available`/`writable` и revision.
4. Находит провайдера в **серверном** snapshot.
5. Проверяет, что route не занят чужим адаптером.
6. Строит профиль через `providerConfigFragment`:
   - installed catalog: без `api`/`baseURL`, `models` опционально;
   - hand-declared: обязательны `api`, `baseURL`, минимум одна модель;
   - `models[].input` ограничен `text`/`image` (схема `llm-pi-ai` не принимает
     audio/video/file);
   - существующий профиль: merge моделей, сохранение endpoint/protocol/env,
     конфликт endpoint/protocol — отказ.
7. Ограничивает `apiKeyEnv` известными именами провайдера/алиасами/производным
   именем.
8. Вызывает `ctx.settings.update(namespace, {providers:{[routeId]: profile}}, revision)`.
9. Сохраняет ключ через `setCredential` (только если `useEnv !== true`).
10. При `test: true` вызывает `testModel`; ошибка теста не откатывает конфиг.

`testModel`:

- ждёт появления route в `ctx.llm.listProviders()` до 10 с;
- rate-limit 1/10 с на provider/model;
- `ctx.llm.stream` с фиксированным коротким промптом, `maxTokens: 24`,
  `temperature: 0`, timeout 30 с;
- собирает `text-delta`, обрабатывает `finish.reason`;
- ошибки: `MISSING_CREDENTIAL`, `INVALID_CREDENTIAL`, `QUOTA`, `RATE_LIMIT`,
  `UNKNOWN_MODEL`, `NO_ADAPTER`, `TIMEOUT`, `TEST_FAILED`;
- не возвращает ключ и не делает auto-retry.

`discoverModels`:

- вызывает `ctx.llm.discoverModels('llm-pi-ai', request, signal)`;
- для installed catalog достаточно `provider`;
- для draft endpoint — `baseURL` + `api` + опциональный one-shot `apiKey`;
- ключ используется только для этого вызова и не сохраняется автоматически.

## Client

`client.js`:

- `window.__ModuleLoader__.load({id:'dsh-free-models', factory})`;
- только `react` из shared module table;
- регистрирует `settings.section` с id `free-models`, order 12;
- `ctx.locale.register(NS, {en, ru})`, все строки через `t`;
- CSS с префиксом `.dfm-*`, токены `--dsw-alias-*`;
- загружает `/state` и `/catalog` параллельно;
- фильтры: query/kind/api/configuredOnly/showUnverified;
- карточки: провайдер, тип, configured, endpoint, env, модели, evidence, actions;
- setup panel: route id, env, key, useEnv, выбор моделей, fetch models, test,
  add/merge, config preview;
- deep search: внешние ссылки с предупреждением;
- после add/merge вызывает `load(false)` для обновления state/catalog.

Тестовые хуки доступны только при `globalThis.__DSH_FREE_MODELS_TEST__`:
`filterProviders`, `kindLabel`, `formatContext`, `providerText`, `sourceTone`,
`validateRouteId`, словари.

## Безопасность

- Публичные каталоги — без credentials.
- Add-маршрут не доверяет клиентским `baseURL`/`api`/`models`.
- `apiKeyEnv` ограничен известными именами.
- `ctx.credentials` — единственное хранилище ключей.
- Write-маршруты same-origin + JSON + bounded body.
- Тест — explicit, rate-limited, one attempt.
- Deep search — untrusted data.

## Тестовая стратегия

- `normalize.test.mjs` — все источники, фильтры, merge, unverified, capped paid.
- `service.test.mjs` — кэш, TTL, stale, изоляция ошибок, поиск.
- `config.test.mjs` — installed/hand-declared, YAML, merge, конфликты.
- `setup.test.mjs` — add, installed, key, test, rate-limit, discovery, allowlist.
- `http.test.mjs` — same-origin, method, JSON, body, routes.
- `client.test.mjs` — helpers и паритет словарей.
- Сеть в тестах не используется.
