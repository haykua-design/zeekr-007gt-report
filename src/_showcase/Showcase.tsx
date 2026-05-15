import React from 'react';
import { NavBar } from '../components/NavBar';
import { SiteFooter } from '../components/SiteFooter';
import { H1, H2, SectionHeading, Body } from '../components/typography';
import { StatCard } from '../components/StatCard';
import { SpecRow } from '../components/SpecRow';
import { Callout } from '../components/Callout';
import { TradeoffMatrix } from '../components/TradeoffMatrix';
import { KineticNumber } from '../components/KineticNumber';

export function Showcase() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <NavBar />
      
      <main className="max-w-7xl mx-auto px-6 py-20">
        <H1>Design System Showcase</H1>
        <Body>
          这是“极氪 007GT 焕新版”设计语言的预览页。所有组件均遵循精密工程感与电气化强调色的设计原则。
        </Body>

        <section className="mt-16">
          <H2>Color Palette</H2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary text-primary-foreground rounded">Primary (Electric Blue)</div>
            <div className="p-4 bg-accent text-accent-foreground rounded">Accent (Warning Orange)</div>
            <div className="p-4 bg-dark-panel text-dark-panel-foreground rounded">Dark Panel</div>
            <div className="p-4 bg-muted text-muted-foreground rounded border border-border">Muted / Border</div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading>Technical Specs</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              label="充电电压" 
              value={<KineticNumber value={900} suffix="V" />} 
              description="行业领先的超高压平台，补能效率提升 30%"
            />
            <StatCard 
              label="智驾算力" 
              value={<KineticNumber value={700} suffix="TOPS" />} 
              description="Thor-U 芯片方案，强调感知与计算冗余"
            />
            <StatCard 
              label="零百加速" 
              value={<KineticNumber value={2.84} decimals={2} suffix="s" />} 
              unit=""
              description="极氪 007GT 焕新版实测成绩"
            />
          </div>
        </section>

        <section className="mt-16">
          <H2>Data Comparison</H2>
          <div className="max-w-md bg-card p-6 border border-border rounded-lg mb-8">
            <SpecRow label="驱动形式" value="四驱双电机" />
            <SpecRow label="电池容量" value="100kWh" highlight={true} />
            <SpecRow label="续航里程" value="800km (CLTC)" />
          </div>
          
          <TradeoffMatrix 
            headers={['核心维度', '极氪 007GT', '小米 SU7 Max', 'Model 3 Performance']}
            rows={[
              { label: '补能效率', values: ['900V / 5C', '800V / 4C', '400V (V3)'] },
              { label: '智驾方案', values: ['端到端 (Thor)', '端到端 (Orin)', '视觉 (HW4.0)'] },
              { label: '生态互联', values: ['中规中矩', '极佳 (小米生态)', '封闭生态'] },
            ]}
            highlightIndex={1}
          />
        </section>

        <section className="mt-16">
          <H2>Messaging</H2>
          <Callout title="技术解析">
            900V 架构不仅意味着峰值功率的提升，更在于其在第三方桩上的“不挑桩”兼容性。
          </Callout>
          <Callout type="warn" title="购车预警">
            如果您家附近没有极充站，且无法安装私桩，900V 的补能体验在大负荷公共桩上会有所折损。
          </Callout>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default Showcase;
