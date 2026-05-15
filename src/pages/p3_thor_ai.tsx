import { BrainCircuit, CarFront, ParkingCircle, ShieldCheck } from 'lucide-react';
import { Callout } from '@/components/Callout';
import { KineticNumber } from '@/components/KineticNumber';
import { SpecRow } from '@/components/SpecRow';

const blocks = [
  {
    icon: BrainCircuit,
    title: "Thor-U 的重点是冗余",
    copy: "700TOPS 不等于每天都更聪明，但它给端到端模型、泊车感知和复杂路口处理留了更大的算力预算。",
  },
  {
    icon: ParkingCircle,
    title: "新手最该看泊车",
    copy: "对第一次买车的人来说，自动泊车的稳定性比高速领航更高频。试驾时要刻意找窄车位、斜列车位和地下车库。",
  },
  {
    icon: ShieldCheck,
    title: "安全感来自可预期",
    copy: "优秀智驾不是炫技，而是少急刹、少抢方向、少让你猜它下一步要做什么。",
  },
];

export default function ThorAiPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
      <div className="grid lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-7">
          <p className="font-mono text-sm text-primary mb-4">AI DRIVING / THOR-U</p>
          <h1 className="text-display font-bold">Thor 芯片不是“自动驾驶魔法”，它是减少突兀感的硬件底座。</h1>
        </div>
        <div className="lg:col-span-5">
          <p className="text-lg leading-8 text-muted-foreground">
            智驾上限要分两层看：硬件是否给未来算法留余量，以及你所在城市的功能是否已经开放。007GT 的优势在前者，购买前要核验后者。
          </p>
        </div>
      </div>

      <div className="mt-section grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-dark-panel text-dark-panel-foreground rounded-lg p-6 border border-dark-panel">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-dark-panel-foreground/60">COMPUTE RESERVE</span>
            <CarFront className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-8 font-mono text-7xl font-bold text-primary">
            <KineticNumber value={700} suffix="TOPS" />
          </div>
          <div className="mt-8 space-y-1">
            <SpecRow label="芯片平台" value="NVIDIA Thor-U" highlight />
            <SpecRow label="传感器" value="31 颗公开口径" />
            <SpecRow label="激光雷达" value="全系标配口径" highlight />
            <SpecRow label="体验重点" value="泊车 / 城区 / 高速" />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {blocks.map((block, index) => {
            const Icon = block.icon;
            return (
              <article key={block.title} className={`bg-card text-card-foreground border border-border rounded-lg p-6 grid md:grid-cols-[56px_1fr] gap-5 hover:border-primary hover:-translate-y-1 transition-all duration-base ease-precision ${index === 1 ? 'md:ml-10' : ''}`}>
                <div className="h-14 w-14 bg-primary text-primary-foreground rounded flex items-center justify-center">
                  <Icon aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{block.title}</h2>
                  <p className="mt-3 text-muted-foreground leading-7">{block.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-section bg-card text-card-foreground border border-border rounded-lg p-6">
        <h2 className="text-h1 font-bold">把智驾试驾做成压力测试</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {["无保护左转", "地下车库泊车", "环路施工改道"].map((item, index) => (
            <div key={item} className="border border-border bg-muted rounded p-5">
              <div className="font-mono text-primary text-sm mb-3">0{index + 1}</div>
              <div className="font-bold">{item}</div>
              <p className="mt-2 text-sm text-muted-foreground leading-6">记录接管次数、语音提示是否清楚、动作是否让家人紧张。</p>
            </div>
          ))}
        </div>
      </div>

      <Callout title="判断标准" type="info">
        首购用户不要追求“全程不碰方向盘”的戏剧感；更实用的标准是，每一次系统退出、提醒或接管，你是否都能提前理解原因。
      </Callout>
    </section>
  );
}
