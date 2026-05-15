# Vite + React + TypeScript 模板

快速开始使用 React + TypeScript + Vite 构建现代 Web 应用。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview

# 构建并运行浏览器检测
pnpm build:test

# 仅运行浏览器检测（需要先构建）
pnpm test:browser
```

### test:browser 与进程清理

若 `pnpm run test:browser` 或 `pnpm run build:test` 被中途中断（如 Ctrl+C、任务管理器结束），可能残留 node 或 Vite 进程。若再次运行发现端口被占用或启动异常，请手动结束占用该端口的进程，或在任务管理器中结束相关 node 进程后重试。

## 开发指南

### 核心概念

**显式路由表**：所有路由集中在 `src/routes.ts` 数组中。新增页面时，需要同时添加页面文件和对应的路由条目。`pnpm run check:routes` 会校验两边对称（孤儿页面 / 缺失页面都会报错）。

**站点布局根**：`src/App.tsx` 渲染 `<header><NavBar/></header>` + `<main><Routes/></main>` + `<footer><SiteFooter/></footer>`。改布局形状（如换成侧边栏）就编辑 `App.tsx`；改导航/页脚内容就编辑 `src/components/NavBar.tsx` / `SiteFooter.tsx`。

### 添加新页面

1. 创建 `src/pages/p{N}_{slug}.tsx`：

```typescript
// src/pages/p2_about.tsx
export default function About() {
  return <div>关于我们</div>;
}
```

2. 在 `src/routes.ts` 添加路由条目：

```typescript
import { lazy } from 'react';

export const routes = [
  { path: '/', component: lazy(() => import('./pages/p1_overview')) },
  { path: '/about', component: lazy(() => import('./pages/p2_about')) },
];
```

**约定**：
- 首页是 `src/pages/p1_<slug>.tsx`（slug 自选：`p1_index`、`p1_overview`、`p1_popmart`…）。`check:homepage` 校验：`p1_*.tsx` 有且仅有一个，且 `/` 路由 import 它。
- 文件名前缀 `p{N}_` 仅用于人类排序参考，URL 由 `routes.ts` 中的 `path` 决定。
- 页面间链接使用 `routes.ts` 里注册过的 path（`/`, `/about`），不要写文件名（`/p2_about` 是错的）。

### 自定义导航栏与站点布局

- 修改导航条目、品牌、链接 → 编辑 `src/components/NavBar.tsx`（替换 `PLACEHOLDER_NAVBAR` 标记注释）。
- 修改页脚内容 → 编辑 `src/components/SiteFooter.tsx`。
- 修改布局形状（header/main/footer 顺序、换成侧栏等）→ 编辑 `src/App.tsx`。

```typescript
// src/components/NavBar.tsx 里写真实导航：
import { AppLink } from './AppLink';
export function NavBar() {
  return (
    <nav className="flex gap-6 px-6 py-4">
      <AppLink to="/">首页</AppLink>
      <AppLink to="/about">关于</AppLink>
    </nav>
  );
}
```

页面级布局（区块、分栏等）在各页面组件中实现，不在 NavBar / App.tsx。

### 文件组织

**推荐的文件结构**：

```
项目根目录/
  ├── public/
  │   └── assets/         # 下载的文件（图片、PDF、爬取的网页等）
  │                       # 可通过 /assets/filename 访问
  └── src/
      ├── pages/          # 页面目录
      │   ├── p1_<slug>.tsx  # 首页 (/) — 任意 slug，但有且仅有一个 p1_*.tsx
      │   └── components/ # 页面相关组件（可选）
      │       └── ProductCard.tsx
      ├── knowledge-base/ # 知识内容（Markdown、JSON等）
      │                   # 可在代码中 import 或 fetch
      ├── App.tsx         # 站点布局根（header / main / footer）
      ├── routes.ts       # 路由表（手动维护：path + lazy import）
      └── components/     # 通用组件
          ├── NavBar.tsx        # 导航栏内容（编辑这里）
          └── SiteFooter.tsx    # 页脚内容（编辑这里）
```

**页面组件组织**：

如果页面代码较多，可以将相关组件放在 `pages/components/` 目录：

```
pages/
  ├── Products.tsx
  └── components/
      ├── ProductCard.tsx
      ├── ProductList.tsx
      └── hooks/
          └── useProducts.ts
```

### 组件使用

**AppLink** - 统一链接组件：

```tsx
<AppLink to="/about">关于我们</AppLink>              // 内部路由
<AppLink to="https://example.com">外部链接</AppLink>  // 外部链接
```

**架构图 / 流程图容器** - 直接用 `<figure>` + Tailwind 自己写：

```tsx
<figure className="bg-card text-card-foreground border rounded-2xl p-6">
  <figcaption className="text-sm font-bold uppercase tracking-wider mb-4">
    System Architecture
  </figcaption>
  <svg viewBox="0 0 1000 400" className="w-full">
    {/* inline SVG nodes, arrows, labels */}
  </svg>
</figure>
```

**DdlFormula / DdlFormulaBlock（公式）** - 仅渲染 LaTeX（`$...$` 行内，`$$...$$` 块级）。可放在任意元素内，样式继承父级。页面结构一律用语义化标签（h1、section、ol、p、div），公式处使用 `<DdlFormula>`（行内）或 `<DdlFormulaBlock>`（块级）。不再提供 MarkdownText；TSX 为页面结构的唯一表达方式。

**导航栏**：若某导航项标签含数学，须在该 `<AppLink>` 内使用 `<DdlFormula>`；若用 `getLabel(path)`，则 `getLabel` 应返回 `ReactNode`（如 `<> <DdlFormula>$x^x$</DdlFormula> 导数 </>`），不可对含公式的 path 仅返回纯字符串。导航内仅用 inline DdlFormula。

```tsx
<h1>深度剖析：自幂函数 <DdlFormula>$y = x^x$</DdlFormula></h1>
<p>于是 <DdlFormula>$y' = x^x(1 + \ln x)$</DdlFormula>。</p>
<div className="my-4"><DdlFormulaBlock>{String.raw`$$\ln y = x \ln x$$`}</DdlFormulaBlock></div>
```

导航含公式示例（二选一）：
```tsx
<AppLink to="/x-derivative"><DdlFormula>$x^x$</DdlFormula> 导数</AppLink>
// 或 getLabel(path) 返回 ReactNode：某 path 返回 <> <DdlFormula>$x^x$</DdlFormula> 导数 </>，渲染处写 {getLabel(route.path)}
```

### 样式系统

- **Tailwind CSS** - 工具类样式
- 路径别名：使用 `@/` 代替 `src/`

### 资源文件组织

**`public/assets/` - 下载的文件**

存放运行时动态下载的文件（图片、PDF、爬取的网页等）：

```typescript
// 在代码中访问
<img src="/assets/image.jpg" alt="Image" />
<a href="/assets/document.pdf">下载 PDF</a>

// 或使用 fetch
const html = await fetch('/assets/crawled-page.html').then(r => r.text());
```

**Important**: In **page code** (e.g. `<img src="...">` or `ZoomableImage`), asset URLs must be **`/assets/filename`**, not `/public/assets/filename`. Vite serves the `public` folder at the site root. Report markdown may reference `/public/assets/...`; when implementing the page, use `/assets/...` in `src`, or the browser check will fail.

**按需加载（公式与地图）**

- **公式**：使用 `DdlFormula` / `DdlFormulaBlock`（来自 `@/components/Formula`）即可；KaTeX 会随使用该组件的页面一起加载，未使用公式的项目 dist 中不会包含 KaTeX。
- **地图**：使用地图时从 `@/lib/map` 引入 `MapContainer`、`TileLayer`、`Marker`、`Polyline`、`CircleMarker`、`GeoJSON` 等（以及 `TILES` 常量），不要直接引用 `react-leaflet`；否则生产环境默认 marker 可能未正确设置，且只有通过 `@/lib/map` 使用地图时 Leaflet 才会按需打进对应页面 chunk，无地图项目 dist 中不会包含 Leaflet。

**`src/knowledge-base/` - 知识内容**

存放网站需要展示的知识内容（Markdown、JSON 等）：

```typescript
// 方式一：直接 import（适用于 JSON）
import knowledgeData from '@/knowledge-base/data.json';

// 方式二：动态 fetch（适用于 Markdown 等）
const markdown = await fetch('/knowledge-base/article.md').then(r => r.text());

// 方式三：使用 Vite 的 glob import
const modules = import.meta.glob('@/knowledge-base/**/*.md');
```

## 项目结构

```
项目根目录/
  ├── public/
  │   └── assets/         # 下载的文件（图片、PDF、爬取的网页等）
  │                       # 可通过 /assets/filename 访问
  └── src/
      ├── pages/          # 页面目录
      ├── knowledge-base/ # 知识内容（Markdown、JSON等）
      │                   # 可在代码中 import 或 fetch
      ├── components/     # 可复用组件
      │   ├── AppLink.tsx              # 统一链接组件
      │   ├── Formula.tsx              # 公式（DdlFormula/DdlFormulaBlock），按需拉取 KaTeX
      │   ├── NavBar.tsx               # 站点导航栏（编辑这里）
      │   ├── SiteFooter.tsx           # 站点页脚（编辑这里）
      │   ├── ScrollToTop.tsx          # （自动渲染，无需手动引入）
      │   ├── ScrollToTopOnRouteChange.tsx  # （自动渲染，无需手动引入）
      │   ├── MapView.tsx              # 地图快捷封装
      │   └── ZoomableImage.tsx        # 可缩放图片组件
      ├── lib/           # 工具函数
      │   ├── utils.ts       # 通用工具（如 cn 函数）
      │   └── map.ts         # 地图入口：加载 leaflet.css、修复 marker 图标路径、re-export react-leaflet（含 TILES 常量）
      ├── App.tsx         # 站点布局根（header / main / footer）
      ├── routes.ts       # 路由表（手动维护）
      └── main.tsx        # 应用入口（自动渲染 ScrollToTop chrome）
```

## Dev server 启动时间

**首次启动较慢的常见原因**：

1. **依赖预构建（optimizeDeps）**：Vite 会用 esbuild 预打包 `node_modules` 里用到的依赖，首次会花 10–30+ 秒（依赖数量和机器性能）。结果缓存在 `node_modules/.vite`，同一项目再次启动会快很多。
2. **npx / 包管理器**：已改为在项目内用 `pnpm exec vite` 启动，避免 npx 解析和网络，使用本地安装的 Vite。
3. **依赖多、体积大**：模板里 React、Three、ECharts、KaTeX 等依赖较多，预构建时间会偏长；可通过 `optimizeDeps.include` / `exclude` 微调（需注意不要漏掉必需依赖）。

**可做的优化**：确保项目目录下已执行过 `pnpm install`；同一会话内 dev 常驻、复用已有 dev server，可避免重复冷启动。

## 常见问题

**Q: 如何添加新页面？**  
A: 创建 `src/pages/p{N}_{slug}.tsx`，并在 `src/routes.ts` 添加对应的 `{ path, component: lazy(() => import(...)) }` 条目。`pnpm run check:routes` 会校验两边对称。

**Q: 如何自定义导航栏？**  
A: 编辑 `src/components/NavBar.tsx`（删除 `PLACEHOLDER_NAVBAR` 标记注释）。改布局形状（如换成侧栏）则编辑 `src/App.tsx`。

**Q: 如何添加特殊路由（如动态路由）？**  
A: 在 `src/routes.ts` 直接写——例如 `{ path: '/post/:id', component: lazy(...) }`，`react-router-dom` v6 标准语法。

**Q: 页面代码太多怎么办？**  
A: 将相关组件放在 `pages/components/` 目录，按需导入。

**Q: 需要修改 App.tsx 吗？**  
A: 不需要，`App.tsx` 会自动处理所有路由。

**Q: 下载的文件应该放在哪里？**  
A: 放在 `public/assets/` 目录，可以通过 `/assets/filename` 直接访问。这些文件不会被 Vite 打包处理。注意：在**页面代码**（如 img src）中只写 `/assets/...`，不要写 `/public/assets/...`（Vite 将 public 映射到站点根路径）；report 里可能写 `/public/assets/...`，实现页面时需改为 `/assets/...`，否则 browser check 不通过。

**Q: 知识内容文件应该放在哪里？**  
A: 放在 `src/knowledge-base/` 目录，可以在代码中使用 `import` 或 `fetch` 读取。支持 Markdown、JSON 等格式。

**Q: 如何用公式和地图？**  
A: 公式：使用 `DdlFormula` / `DdlFormulaBlock`（`@/components/Formula`），KaTeX 会按需加载。地图：从 `@/lib/map` 引入 `MapContainer`、`TileLayer`、`Marker`、`Polyline`、`CircleMarker`、`GeoJSON` 等（以及 `TILES` 常量），不要直接只用 `react-leaflet`，否则生产环境默认 marker 可能异常且 Leaflet 会始终打进 dist。`@/lib/map` 是一层很薄的胶水：加载 `leaflet.css`、修复 marker icon 路径，并 re-export `react-leaflet` —— 用法和原生 react-leaflet 完全一致。

## 浏览器检测

项目集成了 Playwright 浏览器检测功能，可以自动检测：

- **Console 错误**：JavaScript 运行时错误
- **页面错误**：未捕获的异常
- **路由导航**：自动检测所有路由的加载情况
- **占位符检测**：检测页面中的占位符文本（简化版）

**检测逻辑（check-browser.mjs）**：目标是把浏览器可见错误和相关网络/运行时失败完整返回给 Coder。

1. **上下文覆盖**（首次导航前注册）：
   - 主页面 + 新开页面（`context.on('page')`）+ popup（`page.on('popup')`）+ worker（`page.on('worker')`）。
   - 监听 `console`、`pageerror`、`unhandledrejection`、`requestfailed`、`response`。
2. **页面发现与遍历**：
   - 先从 `window.__APP_ROUTES__` 读取路由种子。
   - 再从 `src/pages/*.tsx` 做文件系统兜底扫描并合并，避免仅靠前端暴露变量导致漏检。
   - 再从每个已访问页面提取内部链接，加入待访问队列（同域、去重、上限控制）。
   - 若超过 `DDT_MAX_PAGES` 导致目标被截断，会产生 `coverage-truncated` 错误并使检测失败（防止“没测完也通过”）。
3. **收集内容**：
   - 错误写入 `errors`，包含 `route`/`routeUrl`，并附带 `pageId`/`contextType`/`sourceUrl` 等上下文信息。
   - 占位符、裸公式等质量问题写入 `errors` 或 `warnings`。
   - 最后输出单个 JSON（成功 stdout，失败 stderr）。

因此，控制台 error、未捕获异常、Promise 拒绝、请求失败、4xx/5xx 以及 popup/新窗口中的同类错误都会进入检测结果。**Dev 模式**下若出现 Vite 错误遮罩，会提取遮罩文案写入 `runtime-error` 的 `text` 与 `viteErrorContent`。**遗留占位符**会写入 `errors`（type: `placeholder-left`）并导致失败；**裸数学公式**写入 `warnings`（type: `raw-formula`），仅作提示。

**可选环境变量**：

- `DDT_BROWSER_ERROR_POLICY`：`balanced`（默认）或 `strict`。  
  `balanced` 会过滤部分明显噪音网络错误；`strict` 尽量不过滤。
- `DDT_MAX_PAGES`：最大页面遍历数量，默认 `200`。
- `DDT_ENABLE_CONTEXT_COVERAGE`：是否启用多上下文覆盖，默认 `true`。
- `DDT_ERROR_DEDUPE_MODE`：`route`（默认，按路由去重）或 `global`（全局去重）。
- `DDT_ROUTE_TIMEOUT`：单页导航超时（毫秒），默认 `30000`。
- `DDT_POST_NAVIGATION_DELAY_MS`：单页导航后额外等待时间（毫秒），默认 `3000`（用于捕获延迟上报错误）。
- `DDT_BROWSER_CHECK_TIMEOUT_MS`：`start-preview-and-test.mjs` 的总超时（毫秒），默认 `240000`。
- 兼容原有开关：`DDT_CHECK_LINKS`、`DDT_CHECK_IMAGES`、`DDT_CHECK_PLACEHOLDERS`。
- `DDT_CHECK_OVERFLOW`：默认开启。检测 `<main>` 内容素 `overflow: visible` 且 `scrollWidth/Height > clientWidth/Height` 的"文字外溢"情况（bridge 导入文本超出容器并与相邻内容重叠）。可通过 `DDT_OVERFLOW_TOLERANCE_PX`（默认 `1`）放宽阈值。

**质量门禁（project_check）固定策略**：

- `project_check` 在执行 browser check 时会强制注入严格配置（`strict` + 全检查开启 + 上下文覆盖开启），并覆盖同名环境变量，避免外部环境把质检弱化。

**使用方法**：

```bash
# 构建并运行检测
pnpm build:test

# 仅运行检测（需要先构建）
pnpm test:browser
```

检测脚本位于 `_internal/` 目录，client 无需感知。检测结果会输出 JSON 格式，便于工具解析。

**注意**：`pnpm run test:browser`/`pnpm run build:test` 默认会先尝试自动执行 `npx playwright install chromium`。如需关闭自动安装，可设置 `DDT_AUTO_INSTALL_PLAYWRIGHT=0` 后手动执行 `pnpm exec playwright install chromium`。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理（HashRouter）
- **Tailwind CSS** - 样式系统
- **Playwright** - 浏览器检测（开发依赖）
