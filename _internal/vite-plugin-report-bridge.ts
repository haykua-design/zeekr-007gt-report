// Vite plugin: report bridge.
//
// Runs build-report-bridge once at server/build start so .gen.ts files exist
// before any page tries to import them, and re-runs on .md changes during dev
// (then triggers HMR for the regenerated .gen.ts file).
//
// Why a plugin: pages import from `@/reports/.generated/*.gen.ts`. If those
// files don't exist when Vite resolves imports, the dev server 500s. A plugin
// guarantees codegen happens at the right point in the lifecycle, so authors
// never have to remember to run it manually.

import path from 'node:path';
import type { Plugin } from 'vite';
// @ts-expect-error — .mjs has no .d.ts
import { buildReportBridge } from './build-report-bridge.mjs';

export function reportBridge(): Plugin {
  let templateRoot: string;
  return {
    name: 'ddt:report-bridge',
    enforce: 'pre',
    configResolved(config) {
      templateRoot = config.root;
      buildReportBridge({ templateRoot });
    },
    configureServer(server) {
      const reportsDir = path.resolve(templateRoot, 'src/reports');
      server.watcher.add(path.join(reportsDir, '*.md'));
      server.watcher.on('change', (file) => {
        if (!file.startsWith(reportsDir) || !file.endsWith('.md')) return;
        const { written } = buildReportBridge({ templateRoot, quiet: true });
        // Trigger HMR for every regenerated module so importers refresh.
        for (const out of written) {
          const mod = server.moduleGraph.getModuleById(out);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: 'full-reload' });
        const rel = path.relative(templateRoot, file);
        // eslint-disable-next-line no-console
        console.log(`[report-bridge] ${rel} changed → regenerated`);
      });
    },
  };
}
