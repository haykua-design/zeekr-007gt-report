import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App.tsx";
import { routes } from "./routes";
import { ScrollToTop } from "./components/ScrollToTop";
import { ScrollToTopOnRouteChange } from "./components/ScrollToTopOnRouteChange";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error(
    "Root container '#root' not found. Check index.html contains <div id=\"root\"></div>. (React error #299)",
  );
}

// Expose routes for build-time browser audit (optional)
(window as any).__APP_ROUTES__ = routes.map(r => r.path);

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTopOnRouteChange />
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
