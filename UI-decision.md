# UI Decision: 极氪 007GT 焕新版购车决策报告

## 1. Reader & Content Frame
- **One-line audience**: 30万+预算、对新技术感兴趣但担心上手复杂的首购车主。
- **One-line content posture**: 权威引导 (Guide) + 深度对比 (Matrix)——从科普释疑平滑过渡到购车博弈。
- **One-line topic-to-feel mapping**: **精密工程 (Precision Engineering)**——借鉴赛道遥测数据、风洞模拟图与技术白皮书的视觉语言：高对比、电气化色彩、等宽数字、网格节律。

## 2. Site-wide Structural Decisions
- **Page axis**: 垂直滚动 (Vertical Scroll)。
- **Grid skeleton**: 12栏网格，最大宽度 1280px (7xl)。
- **Scroll & transition**: 连续流动 (Continuous flow)，锚点平滑跳转。页面间采用淡入淡出 (Crossfade)。
- **Site shell**: 顶部悬浮 NavBar（半透明磨砂）；页脚包含数据免责声明。

## 3. Color Contract
基于“电气工程与精密制造”的视觉意象，采用 **Mixed-Light** 方案。

| Token pair | Hex (bg / fg) | Role |
|---|---|---|
| `background` / `foreground` | `#F8F9FA` / `#0F172A` | 页面画布：工程白纸感背景，深蓝偏黑文字。 |
| `card` / `card-foreground` | `#FFFFFF` / `#0F172A` | 内容卡片：纯白背景。 |
| `primary` / `primary-foreground` | `#0052FF` / `#FFFFFF` | **电气蓝 (Electric Blue)**：代表 900V、智驾芯片等核心技术强调色。 |
| `accent` / `accent-foreground` | `#FF6B00` / `#FFFFFF` | **警告橙 (Warning Orange)**：用于风险提示、购车行动建议、对比胜出项。 |
| `muted` / `muted-foreground` | `#F1F5F9` / `#64748B` | 辅助色彩：背景修饰、次要文字、表格边框。 |
| `dark-panel` / `dark-panel-foreground` | `#0F172A` / `#F8F9FA` | 反转色彩：用于技术讲解区的重点卡片，营造实验室深色氛围。 |

> **Pairing rule**: Whenever a JSX element sets `bg-X` from the palette table, co-locate `text-X-foreground` in the same `className`. Never paint a surface without its foreground partner.

## 4. Density Mode per Page
| Page | Mode | Reader Task | Layout Shape |
|---|---|---|---|
| p1_verdict | **Airy** | 扫读结论，建立信心 | Hero + Large Card Grid |
| p2_900v_tech | **Mixed** | 理解技术，缓解焦虑 | Asymmetric Split (Text/Visual) |
| p3_thor_ai | **Mixed** | 评估上限，对比冗余 | Alternating Zigzag |
| p4_comparison | **Dense-ref** | 细节对比，权衡矩阵 | Sidebar-pinned + Scrolling Matrix |
| p5_action_list| **Airy** | 匹配画像，采取行动 | Single Column Checklist |

## 5. Typography
- **Heading**: `font-sans` (Inter/System Sans)，Medium/Bold 权重，严谨有力。
- **Body**: `font-sans`，16px，Leading 1.6，优化中文长文阅读。
- **Numerical/Spec**: `font-mono` (JetBrains Mono/Space Mono)，强制 `tabular-nums`。
- **Character**: 标题在大字号下使用 `tracking-tighter`；数字在参数对比中加粗并使用电气蓝。

## 6. Layout Rhythm
- **Technical Section**: 采用 Asymmetric Split (2/3 文本 + 1/3 数据卡片)，将技术原理与实时参数分离。
- **Comparison Section**: 采用固定首列的横向滚动 Matrix，适配移动端。
- **Rhythm**: Section 之间留白 120px。卡片内边距统一为 24px (p-6)。

## 7. Motion Language
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (Quart Out) —— 快速响应，优雅刹车。
- **Signature Moment**: 
  - **KineticNumber**: 900V、零百加速等数值滚动增长。
  - **Matrix Highlight**: 鼠标悬停对比项时，整列/整行同步高亮。
- **Feedback**: Hover 卡片微升 4px，边框色转为 `primary`。

## 8. Shared Components (src/components/)
| Component name | File path | Props | Token references |
|---|---|---|---|
| `H1` / `H2` | `typography.tsx` | children, className | `foreground` |
| `StatCard` | `StatCard.tsx` | label, value, unit, icon? | `primary`, `card`, `font-mono` |
| `SpecRow` | `SpecRow.tsx` | label, value, highlight? | `muted`, `primary` |
| `TradeoffMatrix`| `TradeoffMatrix.tsx`| headers, rows, highlights | `card`, `accent`, `muted` |
| `Callout` | `Callout.tsx` | type (info/warn), children | `primary`, `accent`, `card` |
| `KineticNumber` | `KineticNumber.tsx`| value, suffix, duration | `primary`, `font-mono` |

## 9. Anti-template Self-check
- [x] 非默认深色：采用精密工程感的 Mixed-Light。
- [x] 字体性格：数字强制等宽，体现工程精度。
- [x] 密度适配：对比页 (p4) 必须是紧凑的参考模式。
- [x] 品牌色彩：受限的电气蓝与警告橙。
