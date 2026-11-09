# Сопровождение

## Быстрые команды

```powershell
npm test
node --check index.js
node --check client.js
Get-ChildItem lib -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Локальная установка:

```text
plugin_manager install_bundle target=C:\Users\Evgeniy\Desktop\dsh\Plugins\dsh-free-models
```

После изменения `client.js` обновите страницу Web GUI. HMR клиентских плагинов
работает только при запущенном `pnpm run dev:web` из checkout DSH.

## Обновление курируемого реестра

1. Откройте `data/providers.json`.
2. Для каждой записи проверьте:
   - провайдер действительно предлагает бесплатный уровень/локальный сервер;
   - `docsURL` и `sources[]` открываются и подтверждают это;
   - `api`/`baseURL` корректны для DSH (`openai-completions`,
     `openai-responses`, `anthropic-messages`);
   - `apiKeyEnv` совпадает с документацией провайдера;
   - `verifiedAt` — дата проверки (YYYY-MM-DD).
3. Не добавляйте модели, которых нет в документации/каталоге. Если моделей нет,
   оставьте `models` пустым: плагин возьмёт их из models.dev или discovery.
4. Запустите `npm test`; тест проверит схему, источники и даты.
5. Обновите README, если изменился список провайдеров или поведение.

Правила:

- `free_tier` — это уровень провайдера, а не конкретная модель.
- `trial` — только разовые кредиты; по умолчанию скрыто.
- `local` — LM Studio/Ollama; `http://localhost` разрешён только для local.
- Дата старше 180 дней даёт предупреждение; не удаляйте запись автоматически.

## Добавление источника

1. Создайте `lib/sources/<id>.js` с `id`, `label`, `url`, `timeoutMs`,
   `normalize(payload, fetchedAt)`, `fetchSource(fetchJson, signal)`.
2. Нормализация должна возвращать `{providers, warnings, modelCount}`; провайдеры
   строятся через `providerRecord`/`modelRecord` из `shared.js`.
3. Добавьте модуль в `lib/sources/index.js`.
4. Добавьте fixture-тест в `test/normalize.test.mjs` (без сети).
5. Обновите README/ARCHITECTURE и CHANGELOG.

Требования:

- только `https` для публичных каталогов;
- никаких ключей/cookies;
- ошибки — через `SourceError` с кодом;
- не выдумывать бесплатность: live-цена 0 или явная курируемая запись.

## Изменение endpoint’ов

Если провайдер сменил URL:

1. Обновите `url`/`baseURL` в `lib/sources/*.js` или `data/providers.json`.
2. Проверьте ответ вручную (размер, поля).
3. Обновите fixture и тест.
4. Переустановите плагин и обновите страницу.
5. Проверьте `/dsh-free-models/catalog?refresh=1` (через UI) и source chips.

## Обновление плагина

1. Поднимите `version` в `package.json` и `CHANGELOG.md`.
2. Запустите тесты и `node --check`.
3. Установите локально:
   `plugin_manager install_bundle target=<abs path>`.
4. Если версия та же и установщик её пропускает, удалите bundle и установите
   снова.
5. Проверьте:
   - инструменты `free_models_search` и `free_models_config` видны;
   - Settings → Бесплатные модели открывается;
   - Refresh обновляет каталог;
   - source chips показывают статусы;
   - Add/merge/key/test работают на тестовом провайдере.

## Диагностика

- **Страница не появилась:** проверьте `dsh.client` в `package.json`, обновите
  страницу, посмотрите консоль браузера и логи клиентских модулей.
- **Инструменты не видны:** проверьте, что host active; `ctx.tools` должен быть
  смонтирован; смотрите логи загрузки профиля.
- **Add недоступен:** `ctx.settings` не загружен или профиль read-only; UI
  показывает причину. Проверьте `llm-pi-ai` в профиле.
- **Тест падает `MISSING_CREDENTIAL`:** ключ не сохранён и env не задан.
- **Тест падает `PROVIDER_NOT_READY`:** маршрут ещё не зарегистрирован;
  подождите/повторите.
- **Source error:** проверьте интернет/endpoint; плагин должен показать
  last-good или curated.

## Безопасность

- Не логируйте тело запросов `/add-provider` и `/set-key`.
- Не добавляйте ключи в `data/providers.json`, README, тесты или fixtures.
- Не принимайте произвольные `baseURL`/`api` от клиента для записи.
- Не отключайте same-origin и bounded body без пересмотра модели угроз.
