import { BatteryCharging, Clock3, Snowflake, Zap } from 'lucide-react';
import { Callout } from '@/components/Callout';
import { KineticNumber } from '@/components/KineticNumber';
import { SpecRow } from '@/components/SpecRow';
import { StatCard } from '@/components/StatCard';

export default function NineHundredVoltPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <p className="font-mono text-sm text-primary mb-4">TECH EXPLAINER / 900V</p>
          <h1 className="text-display font-bold max-w-3xl">900V 的价值，不是峰值数字，而是补能不确定性更低。</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl">
            首购用户最怕的是“参数很好，实际很玄”。900V 高压平台的日常意义，是在更多充电场景里减少等待时间，并在低温、连续高速等高负载场景下保留更稳定的热管理余量。
          </p>
        </div>
        <aside className="lg:col-span-4 bg-dark-panel text-dark-panel-foreground rounded-lg p-6 border border-dark-panel">
          <div className="font-mono text-sm text-dark-panel-foreground/60">ENERGY STACK</div>
          <div className="mt-4 font-mono text-6xl font-bold text-primary"><KineticNumber value={900} suffix="V" /></div>
          <p className="mt-4 leading-7 text-dark-panel-foreground/75">
            你真正买到的是补能窗口更短、热效率更高、长途计划更可控。
          </p>
        </aside>
      </div>

      <div className="mt-section grid lg:grid-cols-3 gap-6">
        <StatCard label="长途收益" value="少等" unit="一顿饭" description="高功率充电更容易把休息时间和补能时间重叠。" />
        <StatCard label="冬季收益" value="更稳" unit="热管理" description="高压系统的电流压力更低，热量控制空间更充裕。" />
        <StatCard label="新手收益" value="少算" unit="路线" description="对充电桩功率和电池温度的敏感度下降。" />
      </div>

      <div className="mt-section grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-card text-card-foreground border border-border rounded-lg p-6">
          <h2 className="text-h1 font-bold mb-6">把参数翻译成三种用车场景</h2>
          <div className="space-y-6">
            <div className="grid md:grid-cols-[48px_1fr] gap-4">
              <div className="h-12 w-12 bg-primary text-primary-foreground rounded flex items-center justify-center"><Clock3 aria-hidden="true" /></div>
              <div>
                <h3 className="font-bold text-xl">城市通勤：补电像顺手办事</h3>
                <p className="mt-2 text-muted-foreground leading-7">每周一次高功率补能，体验更接近“下车买杯咖啡”。它不会让你每天都快，但会减少临时缺电时的焦虑。</p>
              </div>
            </div>
            <div className="grid md:grid-cols-[48px_1fr] gap-4">
              <div className="h-12 w-12 bg-primary text-primary-foreground rounded flex items-center justify-center"><Snowflake aria-hidden="true" /></div>
              <div>
                <h3 className="font-bold text-xl">低温高速：关键是热管理冗余</h3>
                <p className="mt-2 text-muted-foreground leading-7">高压平台降低大功率场景下的电流压力，有助于减少持续高速和低温环境下的效率波动。</p>
              </div>
            </div>
            <div className="grid md:grid-cols-[48px_1fr] gap-4">
              <div className="h-12 w-12 bg-accent text-accent-foreground rounded flex items-center justify-center"><BatteryCharging aria-hidden="true" /></div>
              <div>
                <h3 className="font-bold text-xl">长途计划：看兼容性，不只看峰值</h3>
                <p className="mt-2 text-muted-foreground leading-7">真正该在试驾或交付前确认的是：非品牌桩上能否稳定吃到较高功率，以及电池预热策略是否足够透明。</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 bg-card text-card-foreground rounded-lg border border-border p-6">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />试驾时问销售</h3>
          <SpecRow label="900V 是否全系" value="按配置确认" highlight />
          <SpecRow label="最快充电窗口" value="10%-80%" />
          <SpecRow label="第三方桩兼容" value="现场要案例" highlight />
          <SpecRow label="冬季预热策略" value="看车机入口" />
          <SpecRow label="家充功率" value="确认安装条件" />
        </aside>
      </div>

      <Callout title="不要被峰值带跑" type="warn">
        峰值功率只是一瞬间；更重要的是从 10% 到 80% 的平均功率、排队概率、低温衰减和你家/公司附近充电桩的真实密度。
      </Callout>
    </section>
  );
}
