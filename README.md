# dsh-free-models

Плагин DeepSeek Harness для поиска провайдеров и моделей, доступных бесплатно.

Он показывает каталог в **Settings → Бесплатные модели**, даёт агенту read-only
инструменты поиска и умеет по явному подтверждению добавить провайдера в
`llm-pi-ai`, сохранить API-ключ в DSH credentials и отправить один небольшой
тестовый запрос.

## Возможности

- **Живые каталоги:** OpenRouter, Kilo Gateway и Vercel AI Gateway — модели с
  нулевой ценой.
- **models.dev:** метаданные провайдеров, моделей, контекста и endpoint’ов.
- **Курируемый реестр:** проверенные free tier (Groq, Google AI Studio,
  Cerebras, NVIDIA NIM, Cloudflare Workers AI, Mistral, GitHub Models,
  ModelScope, Zhipu, LM Studio, Ollama). У каждой записи есть источник и дата
  проверки.
- **Полная настройка:** выбор моделей, запись маршрута в `llm-pi-ai`, сохранение
  ключа, дополнительная загрузка списка моделей через discovery и тестовый
  запрос.
- **Deep search:** отдельная кнопка и параметр `deep=true` у инструмента агента
  возвращают внешние ссылки на провайдеров; они не считаются проверенными
  фактами.
- **Безопасность:** ключи не попадают в конфиг, ответы и логи; запись конфига
  идёт через `ctx.settings.update` с revision-CAS; add-маршрут принимает только
  `providerKey` и `modelIds` из серверного каталога.

## Установка

Из GitHub:

```text
plugin_manager install_bundle target=https://github.com/kachanov-e-v/dsh-free-models
```

Воспроизводимая установка по тегу релиза:

```text
plugin_manager install_bundle target=https://github.com/kachanov-e-v/dsh-free-models/archive/refs/tags/v0.1.1.tar.gz
```

Локальная разработка:

```text
plugin_manager install_bundle target=C:\Users\Evgeniy\Desktop\dsh\Plugins\dsh-free-models
```

После установки обновите страницу Web GUI. Плагин добавляет запись
`dsh-free-models` в профиль; клиентская часть регистрирует секцию
`settings.section` с id `free-models`.

Проверка host-части: в чате должны появиться инструменты
`free_models_search` и `free_models_config`. Проверка клиента: Settings →
«Бесплатные модели».

## Использование

### Страница

1. Откройте **Settings → Бесплатные модели**.
2. Отфильтруйте по типу бесплатности, протоколу, контексту, поиску или
   «Только настроенные».
3. Нажмите **Добавить в DSH** у провайдера.
4. Выберите route id и модели, при необходимости введите ключ.
5. Нажмите **Добавить и проверить** (один запрос) или **Добавить без теста**.
6. Если ключ не сохранён, повторите сохранение; если тест не прошёл, конфиг
   остаётся записанным, и тест можно повторить.

Для уже существующего маршрута плагин предлагает **merge**: недостающие модели
добавляются, существующие записи и endpoint не перезаписываются. При конфликте
endpoint/протокола нужно выбрать другой route id.

### Инструменты агента

- `free_models_search` — поиск по каталогу. Параметры: `query`, `kind`, `api`,
  `minContext`, `limit`, `configuredOnly`, `includeUnverified`, `deep`,
  `format`. Инструмент ничего не записывает.
- `free_models_config` — готовый фрагмент `providers` для `llm-pi-ai` в YAML или
  JSON. Тоже ничего не записывает.

Пример запроса агенту: «Найди бесплатные модели с контекстом от 200K и покажи
конфиг для OpenRouter».

## Конфигурация плагина

Поля необязательны; значения по умолчанию:

```yaml
- id: dsh-free-models
  name: dsh-free-models
  config:
    cacheTtlMinutes: 720       # 5..1440
    requestTimeoutMs: 15000    # 3000..60000
    sources:
      - curated
      - kilo
      - modelsdev
      - openrouter
      - vercel
    includeTrialCredits: false
    maxModelsPerProvider: 50   # 1..200
    deepSearchMaxResults: 6    # 1..10
```

## Источники и классификация

| Источник | Что даёт |
|---|---|
| `openrouter` | `https://openrouter.ai/api/v1/models`, модели с `pricing.prompt/completion = 0` |
| `kilo` | `https://ai-gateway.kilo.ai/api/v1/models`, явные нулевые цены |
| `vercel` | `https://ai-gateway.vercel.sh/v1/models`, `pricing.input/output = 0` |
| `modelsdev` | `https://models.dev/api.json`, метаданные и cost |
| `curated` | `data/providers.json`, проверенные free tier |
| `dsh` | `ctx.llm.listConfigurableProviders()` / `listProviders()`, уже настроенные маршруты |

Типы:

- `zero_price` — модель с нулевой ценой в live-каталоге.
- `free_tier` — у провайдера документированный бесплатный уровень; лимиты и
  доступность моделей могут отличаться.
- `trial` — разовые кредиты; по умолчанию скрыты.
- `local` — LM Studio/Ollama и подобные локальные серверы.
- `unverified` — `models.dev` сообщает cost 0, но это не подтверждённый free
  tier; по умолчанию скрыто.

Плагин **не выдумывает** модели, лимиты и цены. Курируемая запись без источника
или даты проверки отбрасывается с предупреждением. Дата старше 180 дней
показывается как устаревшая.

## Безопасность

- Каталоги запрашиваются без ключей и cookies.
- Add-маршрут строит конфиг только из доверенного серверного каталога; клиент не
  может подставить произвольный `baseURL`, протокол или модель.
- Ключ валидируется как HTTP-header value и пишется только через
  `ctx.credentials.set`. Значение никогда не возвращается интерфейсу.
- Write-маршруты требуют same-origin, `POST`, `application/json` и ограниченное
  тело запроса.
- Тестовый запрос отправляется только по кнопке, один раз, с rate-limit
  1 раз в 10 секунд на provider/model.
- Deep search возвращает внешние сниппеты как недоверенные данные.

## Ограничения

- Квоты и условия free tier меняются; проверяйте ссылки провайдера.
- Плагин не проверяет бесплатность каждой модели реальным запросом.
- Нет OAuth/sign-in flows; поддерживаются API-ключи и переменные окружения.
- Нет удаления провайдеров и ключей из плагина; используйте Models page.
- Только чат-модели; embeddings/image/audio не входят в каталог.
- Кэш каталога в памяти; после перезапуска первый запрос снова обращается к
  источникам.
- Deep search зависит от настроенного `ctx.web`.

## Тесты

```powershell
npm test
node --check index.js
node --check client.js
Get-ChildItem lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Тесты не ходят в сеть: источники проверяются на фикстурах, setup — на фейковых
`settings`/`credentials`/`llm`.
## Лицензия

MIT.
