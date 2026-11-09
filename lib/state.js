/**
 * Read-only view of the harness provider plane. Used to mark configured routes,
 * learn whether a provider is supplied by the installed pi-ai catalog, and find
 * the llm-pi-ai settings revision before a write.
 */

function service(ctx, name) {
  try {
    return ctx.get(name);
  } catch {
    return undefined;
  }
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function collectCapabilities(ctx) {
  return {
    tools: service(ctx, 'tools') !== undefined,
    webServer: service(ctx, 'webServer') !== undefined,
    web: service(ctx, 'web') !== undefined,
    llm: service(ctx, 'llm') !== undefined,
    settings: service(ctx, 'settings') !== undefined,
    credentials: service(ctx, 'credentials') !== undefined,
  };
}

export async function collectDshState(ctx) {
  const capabilities = collectCapabilities(ctx);
  const warnings = [];
  const llm = service(ctx, 'llm');
  let installed = [];
  let active = [];
  if (llm !== undefined) {
    installed = safeCall(() => llm.listConfigurableProviders(), [])
      .filter((entry) => entry && typeof entry.provider === 'string')
      .map((entry) => ({
        provider: entry.provider,
        displayName: typeof entry.displayName === 'string' ? entry.displayName : entry.provider,
        declared: entry.declared === true,
        defaultBaseURL: typeof entry.defaultBaseURL === 'string' ? entry.defaultBaseURL : null,
        nativeAuth: entry.nativeAuth ?? null,
        settingsNs: typeof entry.settingsNs === 'string' ? entry.settingsNs : 'llm-pi-ai',
        error: typeof entry.error === 'string' ? entry.error : null,
      }));
    active = safeCall(() => llm.listProviders(), [])
      .filter((provider) => provider && typeof provider === 'object')
      .map((provider) => ({
        routeId: typeof provider.id === 'string' ? provider.id : typeof provider.provider === 'string' ? provider.provider : '',
        displayName: typeof provider.displayName === 'string'
          ? provider.displayName
          : typeof provider.name === 'string' ? provider.name : '',
        baseURL: typeof provider.baseURL === 'string' ? provider.baseURL : null,
        models: Array.isArray(provider.models)
          ? provider.models
            .filter((model) => model && typeof model.id === 'string')
            .map((model) => ({
              id: model.id,
              name: typeof model.name === 'string' ? model.name : model.id,
              contextWindow: Number.isFinite(model.contextWindow) ? model.contextWindow : null,
              maxTokens: Number.isFinite(model.maxTokens) ? model.maxTokens : null,
            }))
          : [],
      }))
      .filter((provider) => provider.routeId !== '');
  }

  let settings = null;
  const settingsService = service(ctx, 'settings');
  if (settingsService !== undefined) {
    const descriptors = safeCall(() => settingsService.describe(), []);
    const descriptor = Array.isArray(descriptors)
      ? descriptors.find((entry) => entry && entry.ns === 'llm-pi-ai')
      : undefined;
    if (descriptor !== undefined) {
      settings = {
        namespace: 'llm-pi-ai',
        available: true,
        writable: settingsService.writable !== false,
        revision: Number.isInteger(descriptor.revision) ? descriptor.revision : null,
        providers: descriptor.value && typeof descriptor.value === 'object' && !Array.isArray(descriptor.value)
          ? descriptor.value.providers ?? {}
          : {},
      };
    } else {
      warnings.push('llm-pi-ai settings are not available; adding a provider is disabled.');
    }
  } else {
    warnings.push('The settings service is not loaded; adding a provider is disabled.');
  }

  const credentialsService = service(ctx, 'credentials');
  const credentialStatus = {};
  if (credentialsService !== undefined && settings !== null) {
    const refs = new Set();
    for (const profile of Object.values(settings.providers)) {
      if (profile && typeof profile === 'object' && typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv !== '') {
        refs.add(profile.apiKeyEnv);
      }
    }
    for (const ref of refs) {
      try {
        credentialStatus[ref] = await credentialsService.describe(ref);
      } catch {
        credentialStatus[ref] = { configured: false, writable: false };
      }
    }
  }

  const configured = new Map();
  if (settings !== null) {
    for (const [routeId, profile] of Object.entries(settings.providers)) {
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) continue;
      const activeEntry = active.find((entry) => entry.routeId === routeId);
      const apiKeyEnv = typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv : null;
      configured.set(routeId, {
        routeId,
        displayName: typeof profile.displayName === 'string' && profile.displayName !== ''
          ? profile.displayName
          : activeEntry?.displayName || routeId,
        apiKeyEnv,
        credential: apiKeyEnv === null ? null : credentialStatus[apiKeyEnv] ?? null,
        models: activeEntry?.models ?? [],
        source: 'profile',
      });
    }
  }
  for (const entry of active) {
    if (configured.has(entry.routeId)) continue;
    configured.set(entry.routeId, {
      routeId: entry.routeId,
      displayName: entry.displayName || entry.routeId,
      apiKeyEnv: null,
      credential: null,
      models: entry.models,
      source: 'active',
    });
  }

  return {
    capabilities,
    installed,
    active,
    configured: [...configured.values()].sort((left, right) => left.routeId.localeCompare(right.routeId)),
    settings,
    warnings,
  };
}
