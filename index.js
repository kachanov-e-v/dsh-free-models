/**
 * Host half of dsh-free-models.
 *
 * The catalog service is independent of the harness services; tools and the
 * Settings page are mounted only while their target services exist, so the
 * plugin also loads in a minimal composition.
 */

import { CatalogService } from './lib/service.js';
import { SetupService } from './lib/setup.js';
import { registerHttp } from './lib/http.js';
import { registerTools } from './lib/tools.js';
import { fetchJson } from './lib/util.js';

export const name = 'dsh-free-models';

export function apply(ctx, config = {}) {
  const catalog = new CatalogService({
    config,
    fetchJson,
  });
  const setup = new SetupService({ ctx, catalog });

  ctx.effect(() => () => catalog.dispose(), 'free-models: catalog lifetime');

  ctx.inject(['tools'], (child) => {
    child.effect(() => registerTools(child, { service: catalog }), 'free-models: tools');
  });

  ctx.inject(['webServer'], (child) => {
    registerHttp(child, {
      service: catalog,
      setup,
      config: catalog.config,
    });
  });
}
