import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * 路由变化时自动滚动到页面顶部
 * 解决SPA应用中页面切换后滚动位置保持在底部的问题
 */
export const ScrollToTopOnRouteChange = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // 当路由变化时，立即滚动到顶部
    // 使用 window.scrollTo(0, 0) 确保立即滚动，不使用平滑动画
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // 此组件不渲染任何内容
};

