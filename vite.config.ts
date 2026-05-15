import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';
import { excludeUnusedFonts } from './_internal/vite-plugin-exclude-unused-fonts';
import { reportBridge } from './_internal/vite-plugin-report-bridge';

function resolveExtraFsAllowPaths(): string[] {
  const candidates = new Set<string>();
  try {
    // workspace/node_modules 通常是指向模板 node_modules 的软链接；取其真实路径的父目录作为模板根
    const nodeModulesRealPath = fs.realpathSync(path.resolve(__dirname, 'node_modules'));
    candidates.add(path.resolve(nodeModulesRealPath, '..'));
  } catch {
    // ignore
  }
  return [...candidates];
}

const extraFsAllowPaths = resolveExtraFsAllowPaths();

export default defineConfig({
  // 基础路径：默认相对路径 './'，使 dist 可直接由静态服务提供（如 /api/workspace/dist/{session_id}/），
  // 无需 npm run preview。若需部署到子路径可设 VITE_BASE_PATH（如 '/app/'）。
  base: process.env.VITE_BASE_PATH || './',

  // 每个 workspace 使用独立的 .vite 缓存，避免多 workspace 共享 node_modules 时预构建互相踩踏
  // (504 Outdated Optimize Dep / "Invalid hook call" with null React).
  // 用 process.cwd() 而不是 __dirname：Vite 把 vite.config.ts 转译到
  // template 的 node_modules/.vite-temp/ 后再 import，__dirname 会指向
  // 模板目录，导致缓存又写回模板。process.cwd() 始终是 vite 启动时的
  // workspace 根目录。
  cacheDir: path.resolve(process.cwd(), '.vite'),

  plugins: [
    reportBridge(), // 在 react() 之前：保证 .gen.ts 在 import 解析前已生成
    react(),
    excludeUnusedFonts(), // 自动排除未使用的字体文件，减少构建体积
  ],
  
  // 构建配置
  build: {
    minify: 'esbuild', // 使用 esbuild 压缩（比 terser 快 3-5 倍）
    target: 'es2020',
    // 禁用 sourcemap（生产环境通常不需要，可减少构建时间）
    sourcemap: false,
    // 禁用压缩大小报告（减少构建时间）
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    // 优化 chunk 分割（折中方案：只分离真正独立的大型库，避免循环依赖）
    rollupOptions: {
      // 多 HTML 入口：
      //   - index.html      → 生产站点（routes.ts 驱动的页面）
      //   - showcase.html   → 设计预览（src/_showcase/main.tsx，dev/debug 用）
      // 见 ddl_manuals/rfcs/merge-design-and-shell/。
      input: {
        main: path.resolve(__dirname, 'index.html'),
        showcase: path.resolve(__dirname, 'showcase.html'),
      },
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) {
            return; // 非 node_modules 的代码不分 chunk
          }
          
          // 只分离真正独立、体积大的库（Three.js 核心）
          // 注意：@react-three/* 依赖 React，不在这里分离，会和其他库一起放在 vendor
          if (id.includes('node_modules/three/') && 
              !id.includes('node_modules/@react-three')) {
            return 'three-vendor'; // Three.js 核心，独立且体积大（~500KB）
          }
          
          // 其他所有库（包括 React、@react-three、所有 react-* 包等）都放在一起
          // 这样可以避免循环依赖，因为所有相互依赖的库都在同一个 chunk
          return 'vendor';
        },
      },
    },
  },
  
  // 路径别名：使用 @ 代替 src 目录
  // dedupe: 强制 react / react-dom 只解析到一份。workspace 软链接到 template 的
  //   node_modules 时，子依赖（recharts、@react-three/*…）有可能解析到自己的
  //   react 副本，触发 "Invalid hook call / Cannot read properties of null
  //   (reading 'useContext')"。dedupe 在 module-resolution 层兜底，与
  //   optimizeDeps.include 的"首轮预构建"形成双层保险。
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  // 依赖预构建：entries 是"依赖发现"的入口（从哪开始扫描 import），不是路由里的主页。
  //
  // 为什么把 pages/ 和 reports/.generated/ 也加进 entries：
  //   package.json 里有大量"为 coder 备用"的重型库（mermaid / echarts / recharts /
  //   pixi / globe.gl / lottie / tone / howler / gsap…），它们不被模板自身的 src/
  //   静态导入。仅以 index.html 为 entry 时，Vite 启动扫描看不到这些库，等到 coder
  //   写的页面在浏览器里被加载、运行时才被"懒发现"，触发 re-optimize；此时另一些
  //   动态 chunk（如 mermaid 的 flowDiagram 子模块）正好处于 in-flight，旧的 ?v=
  //   hash 被作废 → 504 (Outdated Optimize Dep) → 浏览器检查失败。
  //
  //   把 pages/**/*.tsx 和 reports/.generated/**/*.ts 加入 entries 后，Vite 启动
  //   时直接扫描所有 coder 实际用到的页面文件 → 真正用到的库在第一轮就预构建完，
  //   "懒发现 → re-optimize" 的竞态彻底消失。未被任何页面 import 的库不会被预
  //   构建（不浪费 dev 启动时间），生产构建走 Rollup tree-shake，dist/ 同样不会
  //   包含未使用的库。
  //
  // include: 强制把所有 Radix 子包纳入首轮预构建。Radix 即使被静态扫到，子包过多
  //   仍可能在运行时分批触发 re-optimize；显式列入 include 可避免——
  //   已加载页面持有旧 chunk URL、新 chunk 又被注入时会出现两个 ReactSharedInternals
  //   副本，表现为 "Invalid hook call / Cannot read properties of null (reading 'useRef')".
  optimizeDeps: {
    entries: [
      'index.html',
      'showcase.html',
      'src/pages/**/*.tsx',
      'src/_showcase/**/*.tsx',
      'src/reports/.generated/**/*.ts',
    ],
    include: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      // recharts 同样会被 coder 页面懒发现：首次渲染时触发 re-optimize，
      // 旧 chunk 持有的 React 与新 chunk 的 React 不是同一个副本，
      // useResponsiveContainerContext → useContext(null) → "Invalid hook call".
      'recharts',
    ],
  },

  // 开发服务器配置
  // fs.allow 包含模板根：workspace 软链接到 template 的 node_modules 时，KaTeX 等字体可被正常提供
  server: {
    host: '127.0.0.1', // 强制使用 IPv4，避免 Windows 上的 IPv6 问题
    // 关闭 HMR：预览通过 demo_system 的反向代理（FastAPI）暴露，后端未代理 WebSocket，
    // 且 5173 端口通常在容器/远端内网不可达。禁用 HMR 可消除 iframe 内的 WS 连接报错，
    // 文件变更时由上层 demo_system 主动触发 iframe reload 即可。
    hmr: false,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, '../../templates/vite-react'),
        // 从 workspace 到仓库根再进入 ddl_client：项目整体移动后相对路径仍正确
        path.resolve(__dirname, '../../../../ddl_client/templates/vite-react'),
        path.resolve(__dirname, '../../../../../ddl_client/templates/vite-react'),
        ...extraFsAllowPaths,
        ...(process.env.DDL_TEMPLATE_VITE_REACT
          ? [path.resolve(process.env.DDL_TEMPLATE_VITE_REACT)]
          : []),
      ],
    },
  },
});
