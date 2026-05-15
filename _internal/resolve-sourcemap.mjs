import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map';

// Resolve sourcemap location for a bundled JS file.
// Usage:
//   node _internal/resolve-sourcemap.mjs <assetUrl> <line> <column>
//
// Example:
//   node _internal/resolve-sourcemap.mjs \
//     "http://127.0.0.1:4173/assets/p0_Home-XXXX.js" 1 20
//
// Output (JSON):
//   { "success": true, "source": "src/pages/Home/index.tsx", "line": 42, "column": 5 }

async function main() {
  const [assetUrl, lineArg, columnArg] = process.argv.slice(2);

  if (!assetUrl || !lineArg || !columnArg) {
    console.error(
      JSON.stringify({
        success: false,
        error: 'Usage: node _internal/resolve-sourcemap.mjs <assetUrl> <line> <column>',
      }),
    );
    process.exit(1);
  }

  const line = Number(lineArg);
  const column = Number(columnArg);

  if (!Number.isFinite(line) || !Number.isFinite(column)) {
    console.error(
      JSON.stringify({
        success: false,
        error: 'line and column must be numbers',
      }),
    );
    process.exit(1);
  }

  try {
    // 当前脚本位于 <projectRoot>/_internal/resolve-sourcemap.mjs
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');

    // 将浏览器加载的 URL 转换为 dist 中的资产路径
    // 例如： http://127.0.0.1:4173/assets/p0_Home-XXXX.js
    //   ->  dist/assets/p0_Home-XXXX.js
    let assetPathname;
    try {
      const url = new URL(assetUrl);
      assetPathname = url.pathname || '';
    } catch {
      // 如果不是合法 URL，则认为已经是相对路径
      assetPathname = assetUrl;
    }

    const assetFilename = path.basename(assetPathname);
    const jsPath = path.join(projectRoot, 'dist', 'assets', assetFilename);
    const mapPath = `${jsPath}.map`;

    if (!fs.existsSync(jsPath) || !fs.existsSync(mapPath)) {
      console.error(
        JSON.stringify({
          success: false,
          error: `JS or sourcemap file not found for asset: ${assetFilename}`,
        }),
      );
      process.exit(1);
    }

    const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

    const result = await SourceMapConsumer.with(rawMap, null, (consumer) => {
      const original = consumer.originalPositionFor({ line, column });
      return original;
    });

    if (!result || !result.source || result.line == null) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'No original position found in sourcemap',
        }),
      );
      process.exit(0);
    }

    console.log(
      JSON.stringify({
        success: true,
        source: result.source,
        line: result.line,
        column: result.column,
      }),
    );
    process.exit(0);
  } catch (err) {
    console.error(
      JSON.stringify({
        success: false,
        error: String(err && err.message ? err.message : err),
      }),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      success: false,
      error: String(err && err.message ? err.message : err),
    }),
  );
  process.exit(1);
});

