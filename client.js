/**
 * Client half: Settings -> Free models.
 *
 * One section renders the discovered catalog, filters, provider cards, a
 * copyable llm-pi-ai fragment, deep web search, and an inline setup panel that
 * can add/merge a provider, store its key, and send one test request.
 *
 * Kept as a hand-written module-loader bundle like the other local plugins, so
 * no build step is required. Only React comes from the shared module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-free-models',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;
    const NS = 'freeModels';

    const en = {
      nav: 'Free models',
      title: 'Free models',
      subtitle: 'Providers and models with a zero price or a documented free tier.',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      updated: 'Updated',
      never: 'never',
      sourceOk: 'ok',
      sourceStale: 'stale',
      sourceError: 'error',
      searchPlaceholder: 'Search provider or model…',
      kindAll: 'All kinds',
      kindZero: 'Zero price',
      kindFree: 'Free tier',
      kindTrial: 'Trial credits',
      kindLocal: 'Local',
      apiAll: 'Any protocol',
      apiOpenAI: 'OpenAI Chat Completions',
      apiResponses: 'OpenAI Responses',
      apiAnthropic: 'Anthropic Messages',
      configuredOnly: 'Configured only',
      showUnverified: 'Show unverified',
      add: 'Add to DSH',
      configure: 'Configure',
      configured: 'Configured',
      test: 'Test',
      copyConfig: 'Copy config',
      docs: 'Docs',
      modelsCount: 'models',
      noModels: 'No free model rows in the catalog; see the provider docs.',
      installedCatalogNote: 'This provider uses the installed pi-ai catalog, so a model list is optional.',
      evidence: 'Evidence',
      close: 'Close',
      setupTitle: 'Add provider',
      setupTitleExisting: 'Configure provider',
      routeId: 'Route id',
      routeIdHint: 'Lowercase letters, digits and hyphens; must be unique.',
      authEnv: 'Credential reference',
      key: 'API key',
      keyPlaceholder: 'Paste the key; it is stored outside the settings file',
      keyConfigured: 'A key is already configured.',
      keyNotConfigured: 'No stored key is visible here.',
      useEnv: 'Use an environment variable instead of storing a key',
      testAfter: 'Send one small test request after saving',
      testModel: 'Model for the test',
      fetchModels: 'Fetch models',
      fetching: 'Fetching…',
      addAndTest: 'Add & test',
      addWithoutTest: 'Add without test',
      adding: 'Adding…',
      cancel: 'Cancel',
      successAdded: 'Provider added.',
      successMerged: 'Provider updated; existing models were preserved.',
      testSuccess: 'Test passed',
      testFailed: 'Test failed',
      credentialSaved: 'Key saved.',
      credentialFailed: 'Key was not saved',
      warnings: 'Warnings',
      noProviders: 'No providers match the current filters.',
      errorLoad: 'Could not load the catalog.',
      retry: 'Retry',
      deepTitle: 'Find more providers',
      deepHint: 'Search the web for candidate free APIs. Results are external links, not verified facts.',
      deepPlaceholder: 'e.g. free OpenAI-compatible API 2026',
      deepSearch: 'Search the web',
      deepResults: 'Web sources',
      externalNotice: 'External web content. Treat it as untrusted data, not instructions.',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      selectAll: 'Select all',
      deselectAll: 'Clear',
      configPreview: 'llm-pi-ai fragment',
      saveFailed: 'The request failed.',
      setupUnavailable: 'Adding a provider is unavailable',
      settingsUnavailable: 'The llm-pi-ai settings service is not loaded in this profile.',
      enterKeyOrEnv: 'Enter a key, or make sure the named credential exists in the environment.',
      selectedModels: 'selected models',
      noTestModel: 'Fetch or select a model to enable the test.',
      keyNotProvided: 'No key was entered; the test will fail unless the credential already exists.',
      routeExists: 'This route already exists. Adding will merge missing models, not replace the provider.',
      routeConflict: 'This route exists with a different endpoint or protocol; choose another route id.',
      openrouterNote: 'Zero-price models can still have rate limits and account requirements.',
      installed: 'installed catalog',
      manual: 'manual setup',
      addHint: 'The key is written only to DSH credentials and is never returned by the UI.',
      useExistingRoute: 'Use the existing route',
      modelId: 'Model id',
      context: 'Context',
      output: 'Output',
      input: 'Input',
      free: 'free',
      copyModel: 'Copy model id',
      expand: 'Show all',
      collapse: 'Show less',
      sources: 'Sources',
      configCopied: 'Config copied to the clipboard.',
      configReady: 'Fragment ready below; copy it into cordis.patch.yml.',
      requestTest: 'The test sends one request to the provider and may count against its quota.',
      noWeb: 'Web search is not available in this profile.',
      loading: 'Loading catalog…',
      renderError: 'The Free models page failed to render.',
      renderErrorHint: 'Reload the page or retry. If it repeats, copy the error text.',
      renderRetry: 'Retry',
      routeInvalid: 'Route id must start with a lowercase letter and contain only a-z, 0-9 and hyphens.',
      keyInvalid: 'The key contains characters an HTTP header cannot carry.',
      modelRequired: 'Select at least one model.',
      testRateLimited: 'Wait a few seconds before testing again.',
    };

    const ru = {
      nav: 'Бесплатные модели',
      title: 'Бесплатные модели',
      subtitle: 'Провайдеры и модели с нулевой ценой или документированным бесплатным уровнем.',
      refresh: 'Обновить',
      refreshing: 'Обновляю…',
      updated: 'Обновлено',
      never: 'никогда',
      sourceOk: 'ok',
      sourceStale: 'устарело',
      sourceError: 'ошибка',
      searchPlaceholder: 'Поиск провайдера или модели…',
      kindAll: 'Все типы',
      kindZero: 'Нулевая цена',
      kindFree: 'Бесплатный уровень',
      kindTrial: 'Пробные кредиты',
      kindLocal: 'Локальные',
      apiAll: 'Любой протокол',
      apiOpenAI: 'OpenAI Chat Completions',
      apiResponses: 'OpenAI Responses',
      apiAnthropic: 'Anthropic Messages',
      configuredOnly: 'Только настроенные',
      showUnverified: 'Показать непроверенные',
      add: 'Добавить в DSH',
      configure: 'Настроить',
      configured: 'Настроен',
      test: 'Проверить',
      copyConfig: 'Копировать конфиг',
      docs: 'Документация',
      modelsCount: 'моделей',
      noModels: 'В каталоге нет бесплатных строк моделей; смотрите документацию провайдера.',
      installedCatalogNote: 'Провайдер использует установленный каталог pi-ai, поэтому список моделей не обязателен.',
      evidence: 'Источники',
      close: 'Закрыть',
      setupTitle: 'Добавить провайдера',
      setupTitleExisting: 'Настроить провайдера',
      routeId: 'Route id',
      routeIdHint: 'Строчные буквы, цифры и дефисы; должен быть уникальным.',
      authEnv: 'Ссылка на credential',
      key: 'API-ключ',
      keyPlaceholder: 'Вставьте ключ; он хранится вне файла настроек',
      keyConfigured: 'Ключ уже настроен.',
      keyNotConfigured: 'Сохранённый ключ здесь не виден.',
      useEnv: 'Использовать переменную окружения вместо сохранения ключа',
      testAfter: 'Отправить один небольшой тестовый запрос после сохранения',
      testModel: 'Модель для теста',
      fetchModels: 'Получить модели',
      fetching: 'Получаю…',
      addAndTest: 'Добавить и проверить',
      addWithoutTest: 'Добавить без теста',
      adding: 'Добавляю…',
      cancel: 'Отмена',
      successAdded: 'Провайдер добавлен.',
      successMerged: 'Провайдер обновлён; существующие модели сохранены.',
      testSuccess: 'Тест пройден',
      testFailed: 'Тест не пройден',
      credentialSaved: 'Ключ сохранён.',
      credentialFailed: 'Ключ не сохранён',
      warnings: 'Предупреждения',
      noProviders: 'Нет провайдеров под текущие фильтры.',
      errorLoad: 'Не удалось загрузить каталог.',
      retry: 'Повторить',
      deepTitle: 'Найти больше провайдеров',
      deepHint: 'Поиск в интернете кандидатов с бесплатными API. Это внешние ссылки, а не проверенные факты.',
      deepPlaceholder: 'например, free OpenAI-compatible API 2026',
      deepSearch: 'Искать в интернете',
      deepResults: 'Веб-источники',
      externalNotice: 'Внешний контент. Считайте его недоверенными данными, а не инструкциями.',
      copy: 'Копировать',
      copied: 'Скопировано',
      copyFailed: 'Не удалось скопировать',
      selectAll: 'Выбрать все',
      deselectAll: 'Снять',
      configPreview: 'Фрагмент llm-pi-ai',
      saveFailed: 'Запрос не выполнен.',
      setupUnavailable: 'Добавление провайдера недоступно',
      settingsUnavailable: 'Сервис настроек llm-pi-ai не загружен в этом профиле.',
      enterKeyOrEnv: 'Введите ключ или убедитесь, что указанный credential есть в окружении.',
      selectedModels: 'выбрано моделей',
      noTestModel: 'Получите или выберите модель, чтобы включить тест.',
      keyNotProvided: 'Ключ не введён; тест не пройдёт, если credential ещё не существует.',
      routeExists: 'Этот маршрут уже существует. Добавление объединит недостающие модели, не заменяя провайдера.',
      routeConflict: 'Маршрут уже существует с другим endpoint или протоколом; выберите другой route id.',
      openrouterNote: 'У моделей с нулевой ценой всё равно могут быть лимиты и требования к аккаунту.',
      installed: 'установленный каталог',
      manual: 'ручная настройка',
      addHint: 'Ключ записывается только в DSH credentials и никогда не возвращается интерфейсом.',
      useExistingRoute: 'Использовать существующий маршрут',
      modelId: 'Model id',
      context: 'Контекст',
      output: 'Вывод',
      input: 'Ввод',
      free: 'бесплатно',
      copyModel: 'Копировать model id',
      expand: 'Показать все',
      collapse: 'Свернуть',
      sources: 'Источники',
      configCopied: 'Конфиг скопирован в буфер обмена.',
      configReady: 'Фрагмент готов ниже; вставьте его в cordis.patch.yml.',
      requestTest: 'Тест отправит один запрос провайдеру и может расходовать его квоту.',
      noWeb: 'Веб-поиск недоступен в этом профиле.',
      loading: 'Загружаю каталог…',
      renderError: 'Страница «Бесплатные модели» не смогла отрисоваться.',
      renderErrorHint: 'Обновите страницу или повторите. Если ошибка повторяется, скопируйте текст ошибки.',
      renderRetry: 'Повторить',
      routeInvalid: 'Route id должен начинаться со строчной буквы и содержать только a-z, 0-9 и дефисы.',
      keyInvalid: 'Ключ содержит символы, недопустимые в HTTP-заголовке.',
      modelRequired: 'Выберите хотя бы одну модель.',
      testRateLimited: 'Подождите несколько секунд перед повторным тестом.',
    };

    const CSS = [
      '.dfm-root{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45}',
      '.dfm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.dfm-title{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em}',
      '.dfm-sub{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.dfm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dfm-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}',
      '.dfm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}',
      '.dfm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.dfm-btn:disabled{opacity:.5;cursor:default}',
      '.dfm-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand)}',
      '.dfm-btn.primary:hover:not(:disabled){filter:brightness(1.06);background:var(--dsw-alias-brand-primary)}',
      '.dfm-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.dfm-input,.dfm-select{height:30px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;min-width:0}',
      '.dfm-input:focus,.dfm-select:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dfm-input.wide{width:100%}',
      '.dfm-filters{display:grid;grid-template-columns:minmax(160px,1fr) repeat(2,minmax(120px,auto));gap:8px;align-items:center}',
      '.dfm-check{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;user-select:none}',
      '.dfm-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}',
      '.dfm-chip.ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
      '.dfm-chip.stale{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary)}',
      '.dfm-chip.error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.dfm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}',
      '.dfm-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px;display:flex;flex-direction:column;gap:9px;min-width:0}',
      '.dfm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
      '.dfm-card-title{font-size:14px;font-weight:650;margin:0}',
      '.dfm-card-route{color:var(--dsw-alias-label-tertiary);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
      '.dfm-meta{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;color:var(--dsw-alias-label-tertiary);font-size:11px}',
      '.dfm-meta b{font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.dfm-meta code,.dfm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;overflow-wrap:anywhere}',
      '.dfm-note{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dfm-models{display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px}',
      '.dfm-model{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:4px 0}',
      '.dfm-model-name{display:flex;flex-direction:column;min-width:0}',
      '.dfm-model-id{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dfm-model-meta{font-size:10px;color:var(--dsw-alias-label-tertiary)}',
      '.dfm-mini{height:22px;padding:0 7px;font-size:11px}',
      '.dfm-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.dfm-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:12px;display:flex;flex-direction:column;gap:10px}',
      '.dfm-panel-wide{grid-column:1/-1}',
      '.dfm-panel h4{margin:0;font-size:13px;font-weight:650}',
      '.dfm-field{display:flex;flex-direction:column;gap:4px}',
      '.dfm-field label{font-size:11px;color:var(--dsw-alias-label-secondary);font-weight:500}',
      '.dfm-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);margin:0}',
      '.dfm-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin:0;white-space:pre-wrap}',
      '.dfm-warn{color:var(--dsw-alias-state-warning-primary);font-size:12px;margin:0;white-space:pre-wrap}',
      '.dfm-success{color:var(--dsw-alias-state-success-primary);font-size:12px;margin:0}',
      '.dfm-model-picker{max-height:180px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:6px;display:flex;flex-direction:column;gap:4px;background:var(--dsw-alias-bg-layer-1)}',
      '.dfm-model-option{display:flex;gap:7px;align-items:flex-start;font-size:12px;padding:2px 0}',
      '.dfm-model-option input{margin-top:2px}',
      '.dfm-pre{margin:0;padding:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;max-height:220px;overflow:auto;white-space:pre;user-select:text}',
      '.dfm-empty{padding:24px;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-tertiary);text-align:center}',
      '.dfm-source-row{display:flex;gap:6px;flex-wrap:wrap}',
      '.dfm-deep{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}',
      '.dfm-link{color:var(--dsw-alias-link);text-decoration:none;overflow-wrap:anywhere}',
      '.dfm-link:hover{text-decoration:underline}',
      '.dfm-toast{position:sticky;bottom:8px;align-self:flex-start;padding:6px 10px;border-radius:7px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.dfm-checkline{display:flex;gap:7px;align-items:flex-start;font-size:12px}',
      '.dfm-checkline input{margin-top:2px}',
      '@media (max-width:560px){.dfm-filters{grid-template-columns:1fr}.dfm-grid{grid-template-columns:1fr}}',
    ].join('');

    function injectCss() {
      if (typeof document === 'undefined') return () => {};
      const tagId = 'dsh-free-models/css';
      if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-free-models';
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    function apiPath(path) {
      const relative = String(path).replace(/^\/+/u, '');
      if (typeof document === 'undefined') return `/${relative}`;
      return new URL(relative, document.baseURI).pathname;
    }

    async function requestJson(path, { method = 'GET', body } = {}) {
      const options = {
        method,
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      };
      if (body !== undefined) {
        options.headers['content-type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetch(apiPath(path), options);
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload === null) {
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        const error = new Error(message);
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    async function copyText(text) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // fall through to the legacy path
      }
      if (typeof document === 'undefined') return false;
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }

    function kindLabel(kind, t) {
      const key = {
        zero_price: 'kindZero',
        free_tier: 'kindFree',
        trial: 'kindTrial',
        local: 'kindLocal',
        unverified: 'kindAll',
      }[kind];
      return key ? t(key) : kind;
    }

    function formatContext(value) {
      if (!Number.isFinite(value) || value <= 0) return '—';
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
      if (value >= 1000) return `${Math.round(value / 1000)}K`;
      return String(value);
    }

    function providerText(provider) {
      return [
        provider.name,
        provider.displayName,
        provider.key,
        provider.routeId,
        ...(provider.models ?? []).flatMap((model) => [model.id, model.name]),
      ].filter(Boolean).join(' ').toLowerCase();
    }

    function filterProviders(providers, { query = '', kind = 'all', api = 'all', configuredOnly = false } = {}) {
      const needle = String(query ?? '').trim().toLowerCase();
      return (Array.isArray(providers) ? providers : []).filter((provider) => {
        if (kind !== 'all' && provider.freeKind !== kind) return false;
        if (api !== 'all' && provider.api !== api) return false;
        if (configuredOnly && provider.configured !== true) return false;
        if (needle !== '' && !providerText(provider).includes(needle)) return false;
        return true;
      });
    }

    function sourceTone(status) {
      return status === 'ok' ? 'ok' : status === 'stale' ? 'stale' : 'error';
    }

    function fmtTime(iso, fallback) {
      if (typeof iso !== 'string' || iso === '') return fallback;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      try {
        return date.toLocaleString();
      } catch {
        return iso;
      }
    }

    function Badge({ children, tone = '', title }) {
      return h('span', { className: `dfm-chip ${tone}`.trim(), title }, children);
    }

    function Button({ children, onClick, disabled = false, variant = '', title, type = 'button' }) {
      return h('button', {
        type,
        className: `dfm-btn ${variant}`.trim(),
        onClick,
        disabled,
        title,
      }, children);
    }

    function CopyButton({ text, label, copiedLabel, failedLabel, onResult, mini = true }) {
      const [state, setState] = React.useState('');
      const run = async () => {
        const ok = await copyText(text);
        setState(ok ? 'ok' : 'failed');
        onResult?.(ok);
        setTimeout(() => setState(''), 1600);
      };
      const title = state === 'ok' ? copiedLabel : state === 'failed' ? failedLabel : label;
      return h('button', {
        type: 'button',
        className: `dfm-btn dfm-mini ${mini ? '' : ''}`.trim(),
        onClick: run,
        title,
        'aria-label': title,
      }, state === 'ok' ? '✓' : '⧉');
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error) {
        try {
          console.error('dsh-free-models: render failed', error);
        } catch {
          // The console is best-effort; the fallback still renders.
        }
      }

      render() {
        if (this.state.error !== null) {
          const t = typeof this.props.t === 'function' ? this.props.t : (key) => en[key] ?? key;
          return h('div', { className: 'dfm-empty' }, [
            h('p', { key: 'title' }, t('renderError')),
            h('p', { className: 'dfm-hint', key: 'hint' }, t('renderErrorHint')),
            h('pre', { className: 'dfm-pre', key: 'error' }, String(this.state.error?.message ?? this.state.error)),
            h(Button, { key: 'retry', onClick: () => this.setState({ error: null }) }, t('renderRetry')),
          ]);
        }
        return this.props.children;
      }
    }

    function SectionShell(props) {
      return h(ErrorBoundary, { t: props.t }, h(FreeModelsSection, props));
    }

    function ModelRow({ model, t, onCopy }) {
      const input = Array.isArray(model.input) && model.input.length > 0 ? model.input.join('+') : 'text';
      return h('div', { className: 'dfm-model' }, [
        h('div', { className: 'dfm-model-name', key: 'name' }, [
          h('span', { className: 'dfm-model-id', title: model.id, key: 'id' }, model.id),
          h('span', { className: 'dfm-model-meta', key: 'meta' }, `${formatContext(model.contextWindow)} ${t('context')} · ${formatContext(model.maxTokens)} ${t('output')} · ${input}`),
        ]),
        h(CopyButton, {
          key: 'copy',
          text: model.id,
          label: t('copyModel'),
          copiedLabel: t('copied'),
          failedLabel: t('copyFailed'),
          onResult: onCopy,
        }),
      ]);
    }

    function ProviderCard({ provider, t, configured, onSetup, onConfig }) {
      const [all, setAll] = React.useState(false);
      const models = Array.isArray(provider.models) ? provider.models : [];
      const visible = all ? models : models.slice(0, 6);
      const countLabel = `${models.length} ${t('modelsCount')}`;
      return h('article', { className: 'dfm-card' }, [
        h('div', { className: 'dfm-card-head', key: 'head' }, [
          h('div', { key: 'titles' }, [
            h('h3', { className: 'dfm-card-title', key: 'title' }, provider.displayName || provider.name || provider.key),
            h('div', { className: 'dfm-card-route', key: 'route' }, `${provider.routeId}${provider.installedCatalog ? ` · ${t('installed')}` : ''}${provider.configured && provider.configuredRouteId && provider.configuredRouteId !== provider.routeId ? ` · ${provider.configuredRouteId}` : ''}`),
          ]),
          h('div', { className: 'dfm-row', key: 'badges' }, [
            h(Badge, { key: 'kind' }, kindLabel(provider.freeKind, t)),
            configured ? h(Badge, { key: 'conf', tone: 'ok' }, t('configured')) : null,
          ]),
        ]),
        h('div', { className: 'dfm-meta', key: 'meta' }, [
          provider.baseURL ? h(React.Fragment, { key: 'url' }, [h('b', { key: 'b' }, 'URL'), h('code', { key: 'c' }, provider.baseURL)]) : null,
          provider.apiKeyEnv ? h(React.Fragment, { key: 'env' }, [h('b', { key: 'b' }, t('authEnv')), h('code', { key: 'c' }, provider.apiKeyEnv)]) : null,
          provider.api ? h(React.Fragment, { key: 'api' }, [h('b', { key: 'b' }, 'API'), h('span', { key: 'c' }, provider.api)]) : null,
          h(React.Fragment, { key: 'models' }, [h('b', { key: 'b' }, t('models')), h('span', { key: 'c' }, countLabel)]),
        ]),
        provider.freeNote ? h('p', { className: 'dfm-note', key: 'note' }, provider.freeNote) : null,
        h('div', { className: 'dfm-models', key: 'models' }, [
          ...visible.map((model) => h(ModelRow, { key: model.id, model, t })),
          models.length === 0 ? h('p', { className: 'dfm-hint', key: 'none' }, t('noModels')) : null,
          models.length > 6 ? h('button', {
            type: 'button',
            className: 'dfm-btn dfm-mini',
            key: 'more',
            onClick: () => setAll((value) => !value),
          }, all ? t('collapse') : `${t('expand')} (${models.length})`) : null,
        ]),
        h('div', { className: 'dfm-actions', key: 'actions' }, [
          h(Button, {
            key: 'setup',
            variant: 'primary',
            onClick: () => onSetup(provider),
            disabled: provider.addable !== true,
            title: provider.addBlockReason || '',
          }, configured ? t('configure') : t('add')),
          h(Button, { key: 'config', onClick: () => onConfig(provider) }, t('copyConfig')),
          provider.configured ? h(Button, {
            key: 'test',
            onClick: () => onSetup(provider),
          }, t('test')) : null,
          provider.docsURL ? h('a', {
            key: 'docs',
            className: 'dfm-btn',
            href: provider.docsURL,
            target: '_blank',
            rel: 'noopener noreferrer',
          }, t('docs')) : null,
        ]),
        provider.evidence?.length > 0 ? h('div', { className: 'dfm-source-row', key: 'sources' }, [
          h('span', { className: 'dfm-hint', key: 'label' }, `${t('sources')}:`),
          ...[...new Set(provider.evidence.map((item) => item.url).filter(Boolean))].slice(0, 3).map((url, index) => h('a', {
            key: `${url}-${index}`,
            className: 'dfm-link dfm-hint',
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
          }, new URL(url).hostname)),
        ]) : null,
      ]);
    }

    function Field({ label, hint, children, id }) {
      return h('div', { className: 'dfm-field' }, [
        h('label', { key: 'label', htmlFor: id }, label),
        children,
        hint ? h('p', { key: 'hint', className: 'dfm-hint' }, hint) : null,
      ]);
    }

    function SetupPanel({ provider, dsh, t, onClose, onChanged }) {
      const [routeId, setRouteId] = React.useState(provider.configuredRouteId || provider.routeId || '');
      const [models, setModels] = React.useState(Array.isArray(provider.models) ? provider.models : []);
      const [selected, setSelected] = React.useState(() => new Set((provider.models ?? []).map((model) => model.id)));
      const [apiKey, setApiKey] = React.useState('');
      const [useEnv, setUseEnv] = React.useState(false);
      const [testAfter, setTestAfter] = React.useState(true);
      const [testModelId, setTestModelId] = React.useState((provider.models ?? [])[0]?.id ?? '');
      const [busy, setBusy] = React.useState('');
      const [error, setError] = React.useState('');
      const [result, setResult] = React.useState(null);
      const [config, setConfig] = React.useState(null);
      const [testModelText, setTestModelText] = React.useState('');

      const configuredEntry = (dsh?.configured ?? []).find((entry) => entry.routeId === routeId)
        ?? (dsh?.configured ?? []).find((entry) => entry.routeId === provider.configuredRouteId)
        ?? (dsh?.configured ?? []).find((entry) => entry.routeId === provider.routeId)
        ?? null;
      const settingsReady = dsh?.settings?.available === true && dsh?.settings?.writable === true;
      const routeError = validateRouteId(routeId);
      const selectedIds = [...selected];
      const installedEntry = (dsh?.installed ?? []).find((entry) => entry.provider === routeId && entry.declared === false);
      const usesInstalledCatalog = installedEntry !== undefined;
      const needsModels = !usesInstalledCatalog;
      const modelReady = selectedIds.length > 0 || !needsModels;
      const canAdd = settingsReady && routeError === null && modelReady && busy === '';
      const env = provider.apiKeyEnv || '';
      const credentialConfigured = configuredEntry?.credential?.configured === true;
      const routeExists = (dsh?.configured ?? []).some((entry) => entry.routeId === routeId);
      const availableTestModels = models.filter((model) => selected.has(model.id) || models.length === selectedIds.length);
      const testModel = testModelId || availableTestModels[0]?.id || '';
      const testReady = testAfter === false || testModel !== '' || testModelText !== '';

      const toggle = (id) => {
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      const fetchModels = async () => {
        setBusy('fetch');
        setError('');
        try {
          const discoveryProvider = usesInstalledCatalog
            ? routeId
            : (provider.installedCatalog === true ? provider.key : undefined);
          const payload = await requestJson('/dsh-free-models/discover-models', {
            method: 'POST',
            body: {
              provider: discoveryProvider,
              ...(discoveryProvider === undefined ? {
                baseURL: provider.baseURL ?? undefined,
                api: provider.api ?? undefined,
              } : {}),
              apiKey: apiKey !== '' ? apiKey : undefined,
            },
          });
          if (!payload.ok) throw new Error(payload.message || t('saveFailed'));
          const discovered = (payload.models ?? []).map((model) => ({
            id: model.id,
            name: model.name,
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
            input: model.inputModalities ?? ['text'],
          }));
          setModels(discovered);
          setSelected(new Set(discovered.map((model) => model.id)));
          setTestModelId(discovered[0]?.id ?? '');
        } catch (failure) {
          setError(failure.message || t('saveFailed'));
        } finally {
          setBusy('');
        }
      };

      const save = async (withTest) => {
        if (!canAdd) return;
        const chosenTest = testModelText !== ''
          ? testModelText
          : (selected.has(testModelId) ? testModelId : selectedIds[0] ?? testModelId);
        setBusy('save');
        setError('');
        setResult(null);
        try {
          const payload = await requestJson('/dsh-free-models/add-provider', {
            method: 'POST',
            body: {
              providerKey: provider.key,
              routeId,
              modelIds: selectedIds,
              ...(apiKey !== '' && !useEnv ? { apiKey } : {}),
              ...(useEnv ? { useEnv: true } : {}),
              ...(withTest ? { test: true, testModelId: chosenTest } : {}),
              includeUnverified: true,
            },
          });
          if (!payload.ok) throw new Error(payload.message || t('saveFailed'));
          setResult(payload);
          if (payload.test?.ok === false) setError('');
          setApiKey('');
          onChanged?.();
        } catch (failure) {
          setError(failure.message || t('saveFailed'));
        } finally {
          setBusy('');
        }
      };

      const copyConfig = async () => {
        setBusy('config');
        setError('');
        try {
          const payload = await requestJson('/dsh-free-models/config', {
            method: 'POST',
            body: {
              providerKey: provider.key,
              routeId,
              modelIds: selectedIds,
            },
          });
          if (!payload.ok) throw new Error(payload.message || t('saveFailed'));
          setConfig(payload);
          const ok = await copyText(payload.yaml);
          setError(ok ? '' : t('copyFailed'));
        } catch (failure) {
          setError(failure.message || t('saveFailed'));
        } finally {
          setBusy('');
        }
      };

      const statusLine = result ? [
        h('p', { key: 'saved', className: 'dfm-success' }, result.created ? t('successAdded') : t('successMerged')),
        result.credential ? h('p', {
          key: 'cred',
          className: result.credential.ok ? 'dfm-success' : 'dfm-warn',
        }, result.credential.ok
          ? (result.credential.configured ? t('keyConfigured') : t('keyNotConfigured'))
          : `${t('credentialFailed')}: ${result.credential.message ?? ''}`) : null,
        result.test ? h('p', {
          key: 'test',
          className: result.test.ok ? 'dfm-success' : 'dfm-error',
        }, result.test.ok
          ? `${t('testSuccess')}: ${result.test.latencyMs} ms${result.test.text ? ` — ${result.test.text}` : ''}`
          : `${t('testFailed')}: ${result.test.code}${result.test.message ? ` — ${result.test.message}` : ''}`) : null,
        (result.warnings ?? []).length > 0 ? h('p', { key: 'warn', className: 'dfm-warn' }, result.warnings.join('\n')) : null,
      ] : null;

      return h('section', { className: 'dfm-panel dfm-panel-wide', 'aria-label': t('setupTitle') }, [
        h('div', { className: 'dfm-row', key: 'head', style: { justifyContent: 'space-between' } }, [
          h('h4', { key: 'title' }, configuredEntry ? t('setupTitleExisting') : t('setupTitle')),
          h(Button, { key: 'close', onClick: onClose }, t('close')),
        ]),
        !settingsReady ? h('p', { className: 'dfm-warn', key: 'settings' }, t('settingsUnavailable')) : null,
        routeExists ? h('p', { className: 'dfm-hint', key: 'route-exists' }, t('routeExists')) : null,
        h(Field, {
          key: 'route',
          label: t('routeId'),
          hint: t('routeIdHint'),
          id: 'dfm-route',
        }, h('input', {
          id: 'dfm-route',
          className: 'dfm-input wide',
          value: routeId,
          onChange: (event) => setRouteId(event.target.value.trim().toLowerCase()),
          spellCheck: false,
          autoComplete: 'off',
        })),
        routeError ? h('p', { className: 'dfm-error', key: 'route-error' }, t('routeInvalid')) : null,
        env ? h('div', { className: 'dfm-hint', key: 'env' }, `${t('authEnv')}: ${env}`) : null,
        h(Field, {
          key: 'key',
          label: t('key'),
          hint: credentialConfigured ? t('keyConfigured') : t('addHint'),
          id: 'dfm-key',
        }, h('input', {
          id: 'dfm-key',
          className: 'dfm-input wide',
          type: 'password',
          value: apiKey,
          onChange: (event) => setApiKey(event.target.value),
          placeholder: t('keyPlaceholder'),
          autoComplete: 'off',
          spellCheck: false,
          disabled: useEnv,
        })),
        h('label', { className: 'dfm-checkline', key: 'useEnv' }, [
          h('input', {
            key: 'checkbox',
            type: 'checkbox',
            checked: useEnv,
            onChange: (event) => setUseEnv(event.target.checked),
          }),
          h('span', { key: 'label' }, t('useEnv')),
        ]),
        h('div', { className: 'dfm-row', key: 'modelActions' }, [
          models.length === 0 ? h(Button, { key: 'fetch', onClick: fetchModels, disabled: busy !== '' }, busy === 'fetch' ? t('fetching') : t('fetchModels')) : null,
          h('span', { className: 'dfm-hint', key: 'count' }, `${selectedIds.length} ${t('selectedModels')}`),
          h('button', {
            key: 'select-all',
            type: 'button',
            className: 'dfm-btn dfm-mini',
            onClick: () => setSelected(new Set(models.map((model) => model.id))),
            disabled: models.length === 0,
          }, t('selectAll')),
          h('button', {
            key: 'clear',
            type: 'button',
            className: 'dfm-btn dfm-mini',
            onClick: () => setSelected(new Set()),
            disabled: selected.size === 0,
          }, t('deselectAll')),
        ]),
        models.length > 0 ? h('div', { className: 'dfm-model-picker', key: 'picker' }, models.map((model) => h('label', {
          key: model.id,
          className: 'dfm-model-option',
        }, [
          h('input', {
            key: 'check',
            type: 'checkbox',
            checked: selected.has(model.id),
            onChange: () => toggle(model.id),
          }),
          h('span', { key: 'text' }, [
            h('span', { className: 'dfm-model-id', key: 'id' }, model.id),
            h('span', { className: 'dfm-model-meta', key: 'meta' }, ` · ${formatContext(model.contextWindow)} ${t('context')} / ${formatContext(model.maxTokens)} ${t('output')}`),
          ]),
        ]))) : h('p', { className: 'dfm-hint', key: 'noModels' }, usesInstalledCatalog ? t('installedCatalogNote') : t('noModels')),
        h('label', { className: 'dfm-checkline', key: 'test' }, [
          h('input', {
            key: 'checkbox',
            type: 'checkbox',
            checked: testAfter,
            onChange: (event) => setTestAfter(event.target.checked),
          }),
          h('span', { key: 'label' }, `${t('testAfter')} — ${t('requestTest')}`),
        ]),
        testAfter ? h(Field, {
          key: 'testModel',
          label: t('testModel'),
          id: 'dfm-test-model',
        }, models.length > 0 ? h('select', {
          id: 'dfm-test-model',
          className: 'dfm-select wide',
          value: testModel,
          onChange: (event) => setTestModelId(event.target.value),
        }, models.map((model) => h('option', { key: model.id, value: model.id }, model.id))) : h('input', {
          id: 'dfm-test-model',
          className: 'dfm-input wide',
          value: testModelText,
          onChange: (event) => setTestModelText(event.target.value),
          placeholder: t('modelId'),
          spellCheck: false,
        })) : null,
        error ? h('p', { className: 'dfm-error', key: 'error' }, error) : null,
        result ? h('div', { key: 'result' }, statusLine) : null,
        h('div', { className: 'dfm-actions', key: 'actions' }, [
          h(Button, {
            key: 'addtest',
            variant: 'primary',
            onClick: () => save(true),
            disabled: !canAdd || !testReady,
            title: !testReady ? t('noTestModel') : (!apiKey && !useEnv && !credentialConfigured ? t('keyNotProvided') : ''),
          }, busy === 'save' ? t('adding') : t('addAndTest')),
          h(Button, { key: 'add', onClick: () => save(false), disabled: !canAdd }, t('addWithoutTest')),
          h(Button, { key: 'config', onClick: copyConfig, disabled: busy !== '' }, t('copyConfig')),
          h(Button, { key: 'cancel', onClick: onClose }, t('cancel')),
        ]),
        config ? h('div', { key: 'config' }, [
          h('p', { className: 'dfm-hint', key: 'ready' }, t('configReady')),
          h('pre', { className: 'dfm-pre', key: 'pre' }, config.yaml),
        ]) : null,
      ]);
    }

    function DeepSearch({ t }) {
      const [query, setQuery] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [result, setResult] = React.useState(null);
      const run = async () => {
        if (query.trim() === '' || busy) return;
        setBusy(true);
        setResult(null);
        try {
          const payload = await requestJson('/dsh-free-models/deep-search', {
            method: 'POST',
            body: { query: query.trim(), maxResults: 6 },
          });
          setResult(payload);
        } catch (error) {
          setResult({ ok: false, message: error.message, sources: [] });
        } finally {
          setBusy(false);
        }
      };
      return h('section', { className: 'dfm-deep' }, [
        h('h3', { className: 'dfm-card-title', key: 'title' }, t('deepTitle')),
        h('p', { className: 'dfm-hint', key: 'hint' }, t('deepHint')),
        h('div', { className: 'dfm-row', key: 'row' }, [
          h('input', {
            key: 'input',
            className: 'dfm-input',
            style: { flex: '1 1 240px' },
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: t('deepPlaceholder'),
            onKeyDown: (event) => { if (event.key === 'Enter') run(); },
          }),
          h(Button, { key: 'button', onClick: run, disabled: busy || query.trim() === '' }, busy ? t('fetching') : t('deepSearch')),
        ]),
        result ? h('div', { key: 'result' }, [
          result.ok === false ? h('p', { className: 'dfm-warn', key: 'err' }, result.message || t('noWeb')) : null,
          result.sources?.length > 0 ? h('div', { key: 'sources' }, [
            h('p', { className: 'dfm-hint', key: 'label' }, `${t('deepResults')} — ${t('externalNotice')}`),
            ...result.sources.map((source, index) => h('div', { key: `${source.url}-${index}`, style: { marginBottom: 6 } }, [
              h('a', {
                className: 'dfm-link',
                href: source.url,
                target: '_blank',
                rel: 'noopener noreferrer',
              }, source.title || source.url),
              source.snippet ? h('p', { className: 'dfm-hint', key: 'snippet', style: { margin: '2px 0 0' } }, source.snippet) : null,
            ])),
          ]) : null,
        ]) : null,
      ]);
    }

    function FreeModelsSection(props) {
      const t = typeof props.t === 'function' ? props.t : ((key) => en[key] ?? key);
      const [catalog, setCatalog] = React.useState(null);
      const [dsh, setDsh] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState('');
      const [query, setQuery] = React.useState('');
      const [kind, setKind] = React.useState('all');
      const [api, setApi] = React.useState('all');
      const [configuredOnly, setConfiguredOnly] = React.useState(false);
      const [showUnverified, setShowUnverified] = React.useState(false);
      const [setupKey, setSetupKey] = React.useState('');
      const [toast, setToast] = React.useState('');

      const load = React.useCallback(async (refresh = false) => {
        setLoading(true);
        setError('');
        try {
          const suffix = `${refresh ? '?refresh=1' : '?'}${showUnverified ? '&unverified=1' : ''}`.replace(/^\?&/u, '?');
          const [stateResult, catalogResult] = await Promise.allSettled([
            requestJson('/dsh-free-models/state'),
            requestJson(`/dsh-free-models/catalog${suffix}`),
          ]);
          if (stateResult.status === 'fulfilled') {
            setDsh(stateResult.value);
          } else {
            setDsh({
              capabilities: {},
              configured: [],
              installed: [],
              settings: null,
              warnings: [stateResult.reason?.message || t('settingsUnavailable')],
            });
          }
          if (catalogResult.status === 'fulfilled') {
            setCatalog(catalogResult.value);
          } else {
            setError(catalogResult.reason?.message || t('errorLoad'));
          }
        } finally {
          setLoading(false);
        }
      }, [showUnverified, t]);

      React.useEffect(() => {
        load(false);
      }, [load]);

      const setToastBrief = (text) => {
        setToast(text);
        setTimeout(() => setToast(''), 1800);
      };

      const openSetup = (provider) => {
        setSetupKey(provider.key);
      };

      const copyProviderConfig = async (provider) => {
        try {
          const payload = await requestJson('/dsh-free-models/config', {
            method: 'POST',
            body: {
              providerKey: provider.key,
              routeId: provider.configuredRouteId || provider.routeId,
              modelIds: (provider.models ?? []).map((model) => model.id),
            },
          });
          if (!payload.ok) throw new Error(payload.message || t('saveFailed'));
          const ok = await copyText(payload.yaml);
          setToastBrief(ok ? t('configCopied') : t('copyFailed'));
        } catch (failure) {
          setToastBrief(failure.message || t('copyFailed'));
        }
      };

      const providers = React.useMemo(() => filterProviders(catalog?.providers ?? [], {
        query,
        kind,
        api,
        configuredOnly,
      }), [catalog, query, kind, api, configuredOnly]);

      const selectedProvider = setupKey === '' ? null : (catalog?.providers ?? []).find((provider) => provider.key === setupKey) ?? null;
      const counts = catalog?.counts ?? { providers: 0, models: 0 };

      return h('div', { className: 'dfm-root' }, [
        h('header', { className: 'dfm-head', key: 'head' }, [
          h('div', { key: 'titles' }, [
            h('h2', { className: 'dfm-title', key: 'title' }, t('title')),
            h('p', { className: 'dfm-sub', key: 'subtitle' }, t('subtitle')),
          ]),
          h('div', { className: 'dfm-row', key: 'actions' }, [
            h('span', { className: 'dfm-hint', key: 'updated' }, `${t('updated')}: ${catalog ? fmtTime(catalog.generatedAt, t('never')) : '—'} · ${counts.providers} / ${counts.models}`),
            h(Button, { key: 'refresh', onClick: () => load(true), disabled: loading }, loading ? t('refreshing') : t('refresh')),
          ]),
        ]),
        catalog?.sources ? h('div', { className: 'dfm-source-row', key: 'sources' }, catalog.sources.map((source) => h(Badge, {
          key: source.id,
          tone: sourceTone(source.status),
          title: source.error || '',
        }, `${source.label}: ${source.status}${source.status === 'ok' ? ` (${source.models})` : ''}`))) : null,
        loading && catalog === null ? h('div', { className: 'dfm-empty', key: 'loading' }, t('loading')) : null,
        error ? h('div', { className: 'dfm-empty', key: 'error' }, [
          h('p', { key: 'text' }, error),
          h(Button, { key: 'retry', onClick: () => load(false) }, t('retry')),
        ]) : null,
        h('div', { className: 'dfm-filters', key: 'filters' }, [
          h('input', {
            key: 'q',
            className: 'dfm-input wide',
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: t('searchPlaceholder'),
          }),
          h('select', {
            key: 'kind',
            className: 'dfm-select',
            value: kind,
            onChange: (event) => setKind(event.target.value),
          }, [
            h('option', { key: 'all', value: 'all' }, t('kindAll')),
            h('option', { key: 'zero', value: 'zero_price' }, t('kindZero')),
            h('option', { key: 'free', value: 'free_tier' }, t('kindFree')),
            h('option', { key: 'trial', value: 'trial' }, t('kindTrial')),
            h('option', { key: 'local', value: 'local' }, t('kindLocal')),
          ]),
          h('select', {
            key: 'api',
            className: 'dfm-select',
            value: api,
            onChange: (event) => setApi(event.target.value),
          }, [
            h('option', { key: 'all', value: 'all' }, t('apiAll')),
            h('option', { key: 'oai', value: 'openai-completions' }, t('apiOpenAI')),
            h('option', { key: 'resp', value: 'openai-responses' }, t('apiResponses')),
            h('option', { key: 'ant', value: 'anthropic-messages' }, t('apiAnthropic')),
          ]),
        ]),
        h('div', { className: 'dfm-row', key: 'toggles' }, [
          h('label', { className: 'dfm-check', key: 'configured' }, [
            h('input', {
              key: 'checkbox',
              type: 'checkbox',
              checked: configuredOnly,
              onChange: (event) => setConfiguredOnly(event.target.checked),
            }),
            h('span', { key: 'label' }, t('configuredOnly')),
          ]),
          h('label', { className: 'dfm-check', key: 'unverified' }, [
            h('input', {
              key: 'checkbox',
              type: 'checkbox',
              checked: showUnverified,
              onChange: (event) => {
                setShowUnverified(event.target.checked);
              },
            }),
            h('span', { key: 'label' }, t('showUnverified')),
          ]),
        ]),
        providers.length === 0 && !loading ? h('div', { className: 'dfm-empty', key: 'empty' }, t('noProviders')) : null,
        h('div', { className: 'dfm-grid', key: 'grid' }, providers.map((provider) => h(React.Fragment, { key: provider.key }, [
          h(ProviderCard, {
            key: 'card',
            provider,
            t,
            configured: provider.configured === true,
            onSetup: openSetup,
            onConfig: copyProviderConfig,
          }),
          setupKey === provider.key ? h(ErrorBoundary, {
            key: 'setup',
            t,
          }, h(SetupPanel, {
            key: 'setup-panel',
            provider,
            dsh,
            t,
            onClose: () => setSetupKey(''),
            onChanged: () => load(false),
          })) : null,
        ]))),
        h(DeepSearch, { key: 'deep', t }),
        toast ? h('div', { className: 'dfm-toast', key: 'toast' }, toast) : null,
      ]);
    }

    function validateRouteId(value) {
      if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) return 'invalid';
      return null;
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, { en, ru }), 'free-models: dictionaries');
      ctx.effect(() => injectCss(), 'free-models: styles');
      ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'free-models',
        order: 12,
        label: () => t('nav'),
        locale: NS,
        inject: () => ({ t }),
      }, SectionShell)), 'free-models: settings section');
    }

    const client = { apply, inject: ['slots', 'locale'] };
    if (globalThis.__DSH_FREE_MODELS_TEST__) {
      client.__test = {
        filterProviders,
        kindLabel,
        formatContext,
        providerText,
        sourceTone,
        validateRouteId,
        ProviderCard,
        SetupPanel,
        DeepSearch,
        FreeModelsSection,
        en,
        ru,
      };
    }
    return client;
  },
});
