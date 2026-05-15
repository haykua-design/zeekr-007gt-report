import { ArrowRight, BatteryCharging, BrainCircuit, Route } from 'lucide-react';
import { AppLink } from '@/components/AppLink';
import { Callout } from '@/components/Callout';
import { KineticNumber } from '@/components/KineticNumber';
import { StatCard } from '@/components/StatCard';
import { carCards } from './reportData';

export default function VerdictPage() {
  return (
    <div className="overflow-hidden">
      <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 animate-fade-up">
            <p className="font-mono text-sm text-primary mb-4">BUYING DECISION / 2026-05-15</p>
            <h1 className="text-h1 md:text-5xl lg:text-6xl leading-tight font-bold max-w-4xl">
              极氪 007GT 焕新版，适合你的第一台 30 万级纯电吗？
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
              结论先说：如果你把“家庭唯一用车”的补能效率、空间弹性和智驾硬件冗余排在前面，007GT 是三车里最值得先试的一台；如果你更重视生态顺手或品牌稳定，SU7 与 Model 3 仍有清晰优势。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AppLink to="/compare" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded font-bold hover:opacity-90 transition-opacity">
                查看三车矩阵
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </AppLink>
              <AppLink to="/action" className="inline-flex items-center gap-2 border border-border bg-card text-card-foreground px-5 py-3 rounded font-bold hover:border-primary hover:text-primary transition-colors">
                直接看试驾清单
              </AppLink>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-lg overflow-hidden border border-border bg-dark-panel text-dark-panel-foreground shadow-card">
              <img
                src="/assets/zeekr-007gt-hero.jpg"
                alt="白色极氪 007 GT 实车照片"
                className="aspect-[13/8] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dark-panel via-dark-panel/70 to-transparent p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="font-mono text-3xl font-bold text-primary"><KineticNumber value={900} suffix="V" /></div>
                    <div className="text-xs text-dark-panel-foreground/70">高压平台</div>
                  </div>
                  <div>
                    <div className="font-mono text-3xl font-bold text-primary"><KineticNumber value={700} suffix="T" /></div>
                    <div className="text-xs text-dark-panel-foreground/70">Thor-U 算力</div>
                  </div>
                  <div>
                    <div className="font-mono text-3xl font-bold text-accent"><KineticNumber value={31} /></div>
                    <div className="text-xs text-dark-panel-foreground/70">感知硬件</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-section">
        <div className="grid md:grid-cols-3 gap-6">
          <StatCard label="补能优先级" value="40" unit="%" description="长途与城市补电的时间确定性，是首购族最容易低估的成本。" />
          <StatCard label="智驾优先级" value="30" unit="%" description="新手要看接管频率、泊车稳定性，而不是只看芯片名。" />
          <StatCard label="家庭适配" value="1" unit="台车" description="唯一用车要同时解决通勤、周末出行和突发装载。" />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-section">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-sm text-primary mb-3">BLUF</p>
            <h2 className="text-display font-bold">三台车的真实定位</h2>
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          {carCards.map((car) => (
            <article key={car.name} className="bg-card text-card-foreground border border-border rounded-lg p-6 hover:-translate-y-1 hover:border-primary transition-all duration-base ease-precision">
              <div className={`inline-flex items-center rounded px-3 py-1 text-xs font-bold mb-5 ${
                car.tone === 'primary' ? 'bg-primary text-primary-foreground' : car.tone === 'accent' ? 'bg-accent text-accent-foreground' : 'bg-dark-panel text-dark-panel-foreground'
              }`}>
                {car.role}
              </div>
              <h3 className="text-2xl font-bold">{car.name}</h3>
              <div className="font-mono text-primary text-xl mt-3">{car.price}</div>
              <dl className="mt-6 space-y-4 text-sm leading-6">
                <div>
                  <dt className="font-bold flex items-center gap-2"><BatteryCharging className="h-4 w-4 text-primary" />更适合</dt>
                  <dd className="text-muted-foreground mt-1">{car.bestFor}</dd>
                </div>
                <div>
                  <dt className="font-bold flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-accent" />要确认</dt>
                  <dd className="text-muted-foreground mt-1">{car.watch}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <Callout title="一句话建议" type="info">
          先预约 007GT 与 SU7 Max 的同日试驾，再把 Model 3 当作“稳定基准线”。如果你当天最在意的是装载、补能和智驾硬件冗余，极氪优先级最高；如果你最在意生态迁移和座舱顺手，小米更像舒适解。
        </Callout>
        <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
          <Route className="h-4 w-4 text-primary" aria-hidden="true" />
          下一步：先把 900V 和 Thor 翻译成日常用车价值。
        </div>
      </section>
    </div>
  );
}
