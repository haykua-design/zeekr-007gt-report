# `src/shell_pages/`

Composite-shell artifacts that **compose** one or more content pages into a
single route. Use this directory only when arrangement itself carries
meaning — timeline overlays, scrollytelling, modal stacks, nested SPA-style
views. The plain multi-page default does not need any file here.

## Role boundary (vs. `src/pages/`)

| `src/pages/p{N}_<slug>.tsx`            | `src/shell_pages/shell{M}_<slug>.tsx`     |
|----------------------------------------|--------------------------------------------|
| One per report (1:1 with `*.md`)       | Imports + composes one or more pages       |
| Renders canonical content              | Renders **no** canonical content of its own |
| Allowed `byId(...)` / `data-block-ref` | Forbidden `byId(...)` / `data-block-ref`   |
| Subject to per-page text-fidelity ratio| Excluded from text-fidelity ratio          |
| No `<header>` / `<nav>` / `<footer>`   | May render any chrome internally           |

The directory IS the role marker. Enforced by `check:shell-host`:

- A file under `src/shell_pages/` MUST contain zero `byId(` and zero
  `data-block-ref=`.
- A file under `src/pages/` MUST NOT import from `../shell_pages/`.

## Composing pages

```tsx
// src/shell_pages/shell1_timeline.tsx
import { lazy, Suspense, useState } from 'react';

const P2 = lazy(() => import('../pages/p2_alpha'));
const P3 = lazy(() => import('../pages/p3_beta'));
const P4 = lazy(() => import('../pages/p4_gamma'));

export default function Shell1Timeline() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <main>
      <TimelineTrack onSelect={setOpen} />
      <Suspense fallback={null}>
        {open === 2 && <Modal onClose={() => setOpen(null)}><P2 /></Modal>}
        {open === 3 && <Modal onClose={() => setOpen(null)}><P3 /></Modal>}
        {open === 4 && <Modal onClose={() => setOpen(null)}><P4 /></Modal>}
      </Suspense>
    </main>
  );
}
```

Register it in `src/routes.ts` like a normal page; the embedded content
pages keep their own routes too. Each `p{i}` is still independently
crawled and its per-route fidelity ratio is measured exactly as before.
