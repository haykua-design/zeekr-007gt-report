import { Scale, Trophy } from 'lucide-react';
import { Callout } from '@/components/Callout';
import { TradeoffMatrix } from '@/components/TradeoffMatrix';
import { comparisonHeaders, comparisonRows } from './reportData';

export default function ComparisonPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
      <div className="grid lg:grid-cols-12 gap-10 items-start">
        <aside className="lg:col-span-3 lg:sticky lg:top-24">
          <div className="bg-dark-panel text-dark-panel-foreground rounded-lg p-6 border border-dark-panel">
            <Scale className="h-6 w-6 text-primary mb-5" aria-hidden="true" />
            <p className="font-mono text-sm text-dark-panel-foreground/60 mb-3">WEIGHT MODEL</p>
            <h1 className="text-3xl font-bold">三车横评权重</h1>
            <div className="mt-6 space-y-4">
              {[
                ["补能效率", "40%"],
                ["智驾易用性", "30%"],
                ["车机交互", "20%"],
                ["品牌效应", "10%"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-dark-panel-foreground/10 pb-3">
                  <span className="text-dark-panel-foreground/75">{label}</span>
                  <span className="font-mono text-primary font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9">
          <p className="font-mono text-sm text-primary mb-4">TRADE-OFF MATRIX</p>
          <h2 className="text-display font-bold">不是谁参数最多，而是谁更贴合“城市通勤 + 家庭唯一车”。</h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl">
            007GT 的强项集中在补能、装载和硬件冗余；SU7 Max 更像生态和座舱体验的顺手解；Model 3 则提供成熟品牌与高效率基线，但高阶智驾和极简交互需要用户适应。
          </p>

          <TradeoffMatrix headers={comparisonHeaders} rows={comparisonRows} highlightIndex={1} />

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <article className="bg-card text-card-foreground border border-primary rounded-lg p-6">
              <Trophy className="h-6 w-6 text-primary mb-4" aria-hidden="true" />
              <h3 className="font-bold text-xl">极氪胜出项</h3>
              <p className="mt-3 text-muted-foreground leading-7">补能体系、猎装装载、智驾硬件冗余，更贴近家庭唯一用车的底层需求。</p>
            </article>
            <article className="bg-card text-card-foreground border border-border rounded-lg p-6">
              <h3 className="font-bold text-xl">小米胜出项</h3>
              <p className="mt-3 text-muted-foreground leading-7">生态迁移、座舱易用和用户热度强，适合手机生态已经深度绑定的人。</p>
            </article>
            <article className="bg-card text-card-foreground border border-border rounded-lg p-6">
              <h3 className="font-bold text-xl">特斯拉胜出项</h3>
              <p className="mt-3 text-muted-foreground leading-7">效率、品牌成熟度和补能稳定性仍强，但配置表达更克制。</p>
            </article>
          </div>

          <Callout title="矩阵结论" type="warn">
            如果你是首购且只有一台车，别把“最强性能版”当作默认答案。把补能、空间、泊车和交互四项放到同一天试驾里比较，答案会比参数表更诚实。
          </Callout>
        </div>
      </div>
    </section>
  );
}
