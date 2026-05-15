import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import { Showcase } from './Showcase';

/**
 * Showcase entry — sibling of main.tsx.
 *
 * Mounted by ../../showcase.html (Vite multi-page entry registered in
 * vite.config.ts under rollupOptions.input). NOT routed through
 * src/App.tsx; the showcase intentionally has no NavBar, no Router,
 * no production layout — it exists to render the design system's
 * primitives and tokens in isolation so a human can sanity-check the
 * Design + Shell phase output before any page copy fans out.
 *
 * Dev:    http://localhost:5173/showcase.html
 * Build:  dist/showcase.html  (excluded from the production deploy
 *         by the demo-system upload step; see RFC merge-design-and-shell)
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Showcase />
    </BrowserRouter>
  </StrictMode>,
);
