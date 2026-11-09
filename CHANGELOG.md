# Changelog

## 0.1.1 — 2026-11-09

Исправление после первого релиза.

- Исправлен краш Settings-страницы при открытии панели «Добавить в DSH»:
  `configuredEntry` обращался к `routeId` до инициализации состояния.
- Добавлен error boundary вокруг секции и панели настройки: ошибка рендера
  показывает текст и кнопку Retry вместо пустого окна.
- Исправлены React key warnings в списках.
- Добавлен regression-тест для панели уже настроенного провайдера.

## 0.1.0 — 2026-11-09

Первая версия.

- Добавлен host-плагин `dsh-free-models` с каталогом бесплатных провайдеров.
- Источники: OpenRouter, Kilo Gateway, Vercel AI Gateway, models.dev и
  курируемый реестр `data/providers.json`.
- Добавлена страница Settings → Бесплатные модели: фильтры, карточки,
  evidence, deep search.
- Добавлены read-only инструменты `free_models_search` и `free_models_config`.
- Добавлена полная настройка: add/merge в `llm-pi-ai`, сохранение ключа через
  DSH credentials, discovery моделей и один тестовый запрос.
- Write-маршруты защищены same-origin, JSON-only и bounded body; ключи не
  возвращаются и не логируются.
- Добавлены тесты (47) и документация.
