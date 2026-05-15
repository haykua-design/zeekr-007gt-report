import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { SiteFooter } from './components/SiteFooter';
import { routes } from './routes';

/**
 * Site shell + route registration.
 *
 * Layout: <header><NavBar/></header> + <main>{page}</main> + <footer><SiteFooter/></footer>.
 * Edit the layout shape here directly. Edit nav/footer content in
 * src/components/NavBar.tsx and src/components/SiteFooter.tsx.
 *
 * Site-level chrome (nav, footer) lives ONLY here — pages must not render
 * <header>/<footer>/<nav> (enforced by `check:anti-patterns`).
 *
 * Body baseline: `bg-background text-foreground font-body antialiased` is the
 * canvas for the whole site. Plain text inherits `foreground` via cascade,
 * so pages do not need explicit `text-*` classes for normal copy. To flip
 * polarity per-page, wrap the page body in a `bg-foreground text-background`
 * container.
 */
export function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body antialiased">
      <header>
        <NavBar />
      </header>

      <main className="flex-1">
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">Loading...</div>}>
                  <route.component />
                </Suspense>
              }
            />
          ))}
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer>
        <SiteFooter />
      </footer>
    </div>
  );
}
