/**
 * Site footer for Zeekr 007GT Buying Decision Report.
 */
export function SiteFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-muted py-12 border-t border-border mt-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary text-primary-foreground rounded flex items-center justify-center text-[10px] font-bold italic">
                GT
              </div>
              <span className="font-bold">极氪 007GT 焕新版购车决策报告</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              本报告基于 2026 年 5 月市场公开数据及技术规格编制，旨在为首购用户提供专业、客观的购车决策参考。
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border border-border">
            <h4 className="text-sm font-bold uppercase mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              数据与免责声明
            </h4>
            <p className="text-tiny text-muted-foreground leading-snug">
              购车涉及大额支出，市场价格及配置可能随政策变动。建议在最终下单前前往极氪授权交付中心实车体验。部分智驾及充电效能数据源自实验室测试环境，实际体感受路况、气温及补能基建影响。
            </p>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-tiny text-muted-foreground">
            &copy; {currentYear} 深度购车决策实验室. All rights reserved.
          </p>
          <div className="flex gap-6 text-tiny text-muted-foreground">
            <span>数据更新: 2026-05-15</span>
            <a className="hover:text-primary transition-colors" href="https://commons.wikimedia.org/wiki/File:Zeekr_007_GT_01_China_2025-04-22.jpg" target="_blank" rel="noreferrer">
              车辆图片: Navigator84 / CC BY-SA 4.0
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
