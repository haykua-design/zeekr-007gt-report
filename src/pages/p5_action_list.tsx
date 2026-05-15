import { CheckCircle2, ClipboardCheck, MapPinned } from 'lucide-react';
import { Callout } from '@/components/Callout';
import { SpecRow } from '@/components/SpecRow';
import { checklist, sourceNotes } from './reportData';

export default function ActionListPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-16 md:pt-24">
      <div className="max-w-3xl">
        <p className="font-mono text-sm text-primary mb-4">ACTION LIST</p>
        <h1 className="text-display font-bold">试驾前，把“喜欢”压成一张核对表。</h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          30 万级首购最怕下单时只记得加速和屏幕。下面这份清单把决策拆成可验证动作：开一圈、停一次、装一次、充一次、算一次。
        </p>
      </div>

      <div className="mt-section grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-card text-card-foreground border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 bg-accent text-accent-foreground rounded flex items-center justify-center">
              <ClipboardCheck aria-hidden="true" />
            </div>
            <h2 className="text-h1 font-bold">购前 5 项必做</h2>
          </div>
          <div className="space-y-4">
            {checklist.map((item, index) => (
              <div key={item} className="grid grid-cols-[40px_1fr] gap-4 border border-border rounded p-4 hover:border-primary transition-colors">
                <div className="font-mono text-primary font-bold">{String(index + 1).padStart(2, '0')}</div>
                <div className="leading-7">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-dark-panel text-dark-panel-foreground rounded-lg p-6">
            <MapPinned className="h-6 w-6 text-primary mb-5" aria-hidden="true" />
            <h3 className="font-bold text-2xl">人群索引</h3>
            <div className="mt-5 space-y-1">
              <SpecRow label="补能焦虑明显" value="优先 007GT" highlight />
              <SpecRow label="米家生态重度用户" value="优先 SU7" />
              <SpecRow label="品牌稳定优先" value="优先 Model 3" />
              <SpecRow label="家庭装载刚需" value="优先猎装尾门" highlight />
            </div>
          </div>

          <div className="bg-card text-card-foreground border border-border rounded-lg p-6">
            <h3 className="font-bold text-xl mb-4">公开信息口径</h3>
            <ul className="space-y-3">
              {sourceNotes.map((note) => (
                <li key={note} className="grid grid-cols-[20px_1fr] gap-3 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-1" aria-hidden="true" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Callout title="最终建议" type="info">
        你的场景是城市通勤兼顾家庭唯一用车，推荐把极氪 007GT 放在第一试驾位，小米 SU7 Max 放在第二试驾位，Model 3 放在价格和稳定性的基准位。真正下单前，以上 5 项有任一项明显不舒服，就不要被参数优势说服。
      </Callout>
    </section>
  );
}
