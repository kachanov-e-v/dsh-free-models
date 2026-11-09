# AGENTS.md

Инструкции для AI-агентов и мейнтейнеров `dsh-free-models`.

## Назначение

Плагин DSH Web GUI, который находит провайдеров с бесплатными моделями,
показывает каталог в Settings, генерирует фрагмент `llm-pi-ai` и по явному
подтверждению добавляет провайдера, сохраняет ключ и проверяет модель.

## Сначала прочитать

1. [README.md](README.md) — пользовательское поведение и ограничения.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — поток данных, контракты, безопасность.
3. [docs/MAINTENANCE.md](docs/MAINTENANCE.md) — обновление источников и курируемого реестра.
4. [ROADMAP.md](ROADMAP.md) — что дальше и что не входит.

## Инварианты

### Сеть и источники

- Сетевые запросы делает только `lib/sources/*` через `fetchJson`.
- В публичные каталоги нельзя отправлять ключи, cookies или session-данные.
- Новый источник обязан иметь fixture-тест и явную нормализацию; нельзя
  добавлять парсинг «на глаз» без теста.
- Ошибка одного источника не скрывает остальные; last-good данные помечаются
  `stale`.

### Бесплатность

- Не выдумывать модели, цены, лимиты и даты.
- Курируемая запись обязана иметь `sources[]` (https) и `verifiedAt`.
- `models.dev` cost 0 без подтверждения — только `unverified`, не `free_tier`.
- `free_tier` относится к провайдеру/квоте, а не к конкретной модели; UI и
  tool-отчёт должны это говорить.
- `verifiedAt` старше 180 дней — предупреждение, а не тихое скрытие.

### Agent tools

- `free_models_search` и `free_models_config` — read-only.
- Инструменты не пишут settings/credentials и не отправляют inference.
- Инструменты не принимают произвольные `baseURL`/`api`/`models` для записи.

### Запись настроек

- Только `ctx.settings.update('llm-pi-ai', patch, revision)` с revision-CAS.
- Профиль строится из серверного каталога; клиент присылает `providerKey`,
  `modelIds`, `routeId`, ключ и флаги.
- Существующий маршрут: merge моделей, сохранение endpoint/protocol/displayName;
  конфликт endpoint/protocol — отказ.
- В сгенерированном `models[].input` допускаются только `text` и `image`;
  остальные модальности каталога отбрасываются.
- Не писать в `cordis.patch.yml` вручную из плагина.

### Секреты

- Ключ только через `ctx.credentials.set`; никогда не возвращать, не логировать,
  не писать в YAML/JSON и не включать в ошибки.
- Валидировать ключ как HTTP-header value.
- Write-маршруты: same-origin, `POST`, `application/json`, bounded body.
- Тест — только по кнопке, один запрос, rate-limit 1/10 с на provider/model.

### Клиент

- `client.js` — hand-written bundle через `window.__ModuleLoader__.load`;
  только `react` из shared module table.
- Секция регистрируется как `settings.section` с id `free-models`, order 12.
- Строки — через `ctx.locale`; ключи `en` и `ru` должны совпадать (тест).
- CSS — с префиксом `.dfm-`, только токены `--dsw-alias-*`.
- Не хардкодить цвета, не ломать другие секции Settings.

### Зависимости

- Runtime без импортов `@deepseek-ai/*`; сервисы берутся через `ctx`.
- Не добавлять зависимости без необходимости; текущий пакет dependency-free.

## Команды

```powershell
npm test
node --check index.js
node --check client.js
Get-ChildItem lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Установка локально:

```text
plugin_manager install_bundle target=<абсолютный путь к этому каталогу>
```

После установки обновить страницу Web GUI. Клиентские изменения подхватываются
после refresh; HMR — только если запущен `pnpm run dev:web` из checkout DSH.

## Definition of done

- [ ] `npm test` проходит.
- [ ] Все `.js` проходят `node --check`.
- [ ] Host active, инструменты видны.
- [ ] Страница открывается в Settings.
- [ ] Add/merge/key/test работают по подтверждению.
- [ ] Ключ не появляется в ответах/логах.
- [ ] README/CHANGELOG обновлены, если поведение изменилось.
