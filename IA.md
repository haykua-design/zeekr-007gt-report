# 极氪 007GT 焕新版深度购车决策报告信息架构

> 数据源需求：`/user_demand_analysis.md`
> 设定日期：2026-05-15（极氪 007GT 焕新版已于 2026 年 4 月上市）
> 目标受众：预算 30 万+、首次购车、对新技术感兴趣但厌恶复杂度的用户。

## 1. Report Archetype
- **Primary**: Comparison（竞品横评）
- **Secondary**: Decision Brief（购车决策简报）
- **Justification**: 用户明确提出了三车对比需求，且最终目标是“适合我买吗”。报告需要通过横向对比消除不确定性，并给出明确的购买建议。
- **Failure modes to actively avoid**:
  - 避免仅堆砌参数（如 900V、20000rpm），必须转化为日常价值。
  - 避免立场偏颇，需针对“家庭唯一用车”和“新手友好度”进行双向评估（优缺点并重）。

## 2. IA Strategy
- **Document-level IA model**: **Pyramid Principle (金字塔原理)**。
  - **Governing Thought**: 极氪 007GT 焕新版是 2026 年 30 万级纯电轿跑中“技术红利”与“驾驶易用性”平衡最好的选择之一，尤其适合在意补能效率与智驾上限的首购族。
- **Local IA models**:
  - 核心科普页：采用 **Explanation (Diátaxis)** 模式，将技术翻译为生活场景。
  - 竞品对比页：采用 **Trade-off Matrix (权重矩阵)**，直观呈现三车在关键维度的胜负。
- **Sub-skills consulted**: `pyramid`, `trade_off_matrix`.

## 3. L1 — Document Logic
- **Reader journey**: 疑惑（新技术值不值得等？） -> 释疑（900V 和 Thor 到底能干嘛？） -> 确认（007GT 的具体规格） -> 犹豫（小米和特斯拉是不是更香？） -> 决策（基于我个人情况的最终建议）。
- **Opening move**: 以“2026 年首购族的焦虑”切入，直接给出三款车的总体评价分流（BLUF）。
- **Closing move**: 提供一份“试驾核对表”和“不同人群购买索引”，将阅读转化为行动。
- **Information hierarchy**: 技术科普（基础层） -> 产品详析（事实层） -> 竞品对比（逻辑层） -> 购买建议（决策层）。

## 4. L2 — Page Plan

### Page 1 — 结论先行：极氪 007GT 焕新版在 2026 年值得首购吗？
- **File**: `/src/reports/p1_verdict.md`
- **Reader question**: 我该花 15 分钟看这份报告吗？极氪 007GT 适合哪类人？
- **Section promise**: 提供三车对比的总体评价和适用人群分类，让用户瞬间找准定位。
- **Role in arc**: 顶层概要（Apex），直接回应核心咨询。
- **Required information**: 三款车型的价格区间（2026年实价）、核心胜出维度、首购族的核心痛点总结。
- **Evidence type**: 汇总数据表、人群分流建议。
- **Suggested length**: 短 (500字)。
- **Transition to next**: “在看车之前，我们先搞清楚困扰你的两个‘玄学’名词：900V 和 Thor。”

### Page 2 — 硬核白话：900V 架构与 Thor 芯片对你每天开车的意义
- **File**: `/src/reports/p2_tech_explainer.md`
- **Reader question**: 这些听起来很牛的技术，能让我充电更快、开车更傻瓜吗？
- **Section promise**: 将枯燥参数翻译为“长途省一顿饭时间”和“新手也能像老司机一样泊车”的日常收益。
- **Role in arc**: 认知对齐，建立评估标准。
- **Required information**: 900V 与传统 400/800V 的补能速度差异、Thor 芯片相比 Orin-X 的代际提升、端到端智驾的体感变化。
- **Evidence type**: 模拟场景对比图、通俗类比。
- **Suggested length**: 中 (1000字)。
- **Transition to next**: “了解了底层技术，我们来看看搭载这些黑科技的极氪 007GT 实际表现如何。”

### Page 3 — 产品解析：极氪 007/007GT 焕新版的核心进化
- **File**: `/src/reports/p3_product_details.md`
- **Reader question**: 2026 款比老款强在哪？30 万预算能买到什么配置？
- **Section promise**: 详述极氪 007GT 的硬核参数，确认其作为“家庭唯一用车”的素质。
- **Role in arc**: 深度事实呈现。
- **Required information**: 2026.04 上市版的核心参数（续航、零百加速、三电系统）、GT 版特有配置。
- **Evidence type**: 官方参数表、实测续航达成率预测。
- **Suggested length**: 中 (800字)。
- **Transition to next**: “硬件满配了，但在小米和特斯拉面前，极氪的软件和品牌力能否胜出？”

### Page 4 — 三车对决：极氪 007GT vs 小米 SU7 vs 特斯拉 Model 3
- **File**: `/src/reports/p4_comparison_matrix.md`
- **Reader question**: 大家都说好，到底谁更适合我的通勤和家庭需求？
- **Section promise**: 通过矩阵对比，揭示三款车在补能网络、智驾上手难度、车机交互上的真实差距。
- **Role in arc**: 核心博弈分析。
- **Required information**: 补能网络（极氪极充 vs 小米 SU7 网络 vs 特斯拉超级充电）、智驾成熟度评级、车机易用性评价。
- **Evidence type**: **Trade-off Matrix (比较矩阵)**。
- **Suggested length**: 长 (1200字)。
- **Transition to next**: “最后的关键：作为新手，你能不能驾驭这些功能？”

### Page 5 — 新手友好度评估：首购族的最终决策指南
- **File**: `/src/reports/p5_user_guide.md`
- **Reader question**: 我是第一次买电动车，哪台车上手最快、风险最小？
- **Section promise**: 针对首购族和家庭用车场景，给出学习成本评估和最终避雷清单。
- **Role in arc**: 落地建议（Resolution）。
- **Required information**: 三车智驾学习曲线、交互复杂度对比、购买前必须确认的 3 件事。
- **Evidence type**: 风险点提示、试驾 Checklist。
- **Suggested length**: 中 (800字)。

## 5. L3 — Content Guidance (per page)

### p1 (Verdict)
- **Key claims**: 极氪 007GT 是“水桶机”进化版，小米 SU7 是“生态专家”，Model 3 是“极简老兵”。
- **Terms to introduce**: 智驾代际、补能冗余。

### p2 (Tech Explainer)
- **900V**: 强调“不挑桩”、“热管理更强导致冬季续航更稳”，而非只是峰值功率。
- **Thor**: 强调“端到端”意味着更像人类驾驶，减少突兀感，而非只讲 TOPS。

### p3 (Product)
- **Data to hunt**: 2026款的具体电池容量（磷酸铁锂 vs 三元锂布局）、极充 5.0/6.0 的兼容性。

### p4 (Comparison)
- **Weights**: 补能效率 (40%) > 智驾易用性 (30%) > 车机交互 (20%) > 品牌效应 (10%)。
- **Critical Comparison**: 对比极氪 Thor 方案与特斯拉 FSD V13/V14 在国内的实际落地体感差距。

### p5 (Guide)
- **Key focus**: 家庭唯一用车的后排舒适度与储物空间（极氪 vs 小米）。

## 6. File Assignments

| File | Page | Owner copy | Independent? |
|---|---|---|---|
| `/src/reports/p1_verdict.md` | 1 | copy-seeker-1 | No (needs data from p3, p4) |
| `/src/reports/p2_tech_explainer.md` | 2 | copy-seeker-2 | Yes |
| `/src/reports/p3_product_details.md` | 3 | copy-seeker-3 | Yes |
| `/src/reports/p4_comparison_matrix.md` | 4 | copy-seeker-4 | Yes |
| `/src/reports/p5_user_guide.md` | 5 | copy-seeker-5 | Yes |

---
**Copy Agent Note**: 后续研究需重点核实 2026 年 4 月极氪发布会的具体细节，包括 900V 是否全系标配以及 Thor 芯片的量产交付进度。
