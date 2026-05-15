# Design System: Zeekr 007GT Report

本文档为 Phase 3 页面 Copy 提供视觉规范与组件清单。

## 1. 颜色与 Tailwind 类名
- **背景**: `bg-background` (白色/浅灰)
- **主文字**: `text-foreground` (深蓝黑)
- **强调色**: `text-primary` / `bg-primary` (电气蓝 `#0052FF`) —— 用于技术参数。
- **警示色**: `text-accent` / `bg-accent` (警告橙 `#FF6B00`) —— 用于购车建议、关键胜出。
- **暗色块**: `bg-dark-panel text-dark-panel-foreground` —— 用于提升科技感。

## 2. 字体与数值
- **数字**: 必须使用 `font-mono` 类名，确保 `tabular-nums` 对齐。
- **数值动画**: 使用 `<KineticNumber value={...} />` 组件实现数值滚动。

## 3. 核心组件 (src/components/)
- `<H1>` / `<H2>`: 标准标题。
- `<SectionHeading>`: 用于科普页面的大节标题（带装饰线）。
- `<StatCard label="..." value="..." unit="..." />`: 用于展示核心性能数据。
- `<SpecRow label="..." value="..." highlight={boolean} />`: 用于列表中的参数对比。
- `<Callout type="info|warn" title="...">`: 用于结论或风险提示。
- `<TradeoffMatrix headers={[]} rows={[]} highlightIndex={number} />`: 用于多车横评。

## 4. 间距策略
- **页面边距**: `max-w-7xl mx-auto px-6`
- **Section 间距**: `mt-section` (120px) 或 `my-section`
- **卡片 Padding**: `p-6` (24px)
