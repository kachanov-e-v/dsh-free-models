# Changelog

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
