import { lazy } from 'react';

/**
 * Route table for Zeekr 007GT Buying Decision Report
 * Organized by IA.md sequence.
 */
export const routes = [
  {
    path: '/',
    component: lazy(() => import('./pages/p1_verdict')),
    label: '购买建议',
  },
  {
    path: '/tech-900v',
    component: lazy(() => import('./pages/p2_900v_tech')),
    label: '900V科普',
  },
  {
    path: '/tech-thor',
    component: lazy(() => import('./pages/p3_thor_ai')),
    label: 'Thor智驾',
  },
  {
    path: '/compare',
    component: lazy(() => import('./pages/p4_comparison')),
    label: '三车横评',
  },
  {
    path: '/action',
    component: lazy(() => import('./pages/p5_action_list')),
    label: '行动清单',
  },
];
