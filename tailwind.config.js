import { TOKENS } from './src/theme/design-tokens.mjs';
import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';
import animate from 'tailwindcss-animate';

// Convert `"Inter, system-ui, sans-serif"` → `['Inter', 'system-ui', 'sans-serif']`
// since Tailwind's `fontFamily` entries are string arrays.
const splitFamily = (value) => String(value).split(',').map((s) => s.trim()).filter(Boolean);

// TOKENS → Tailwind theme.extend bridge.
// Whenever a TOKENS key is present, its value flows into the corresponding
// Tailwind theme namespace, so `bg-X` / `text-X[size]` / `space-X` etc. work
// automatically without hand-editing this file. Coders extend the design
// system by adding keys in `design-tokens.mjs`, never here.
const passthrough = (key) => (TOKENS[key] !== undefined ? { [key]: TOKENS[key] } : {});

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Every key under TOKENS.colors becomes a Tailwind class automatically:
      //   colors.background           → bg-background / text-background / border-background
      //   colors['card-foreground']   → text-card-foreground / bg-card-foreground (kebab passes through)
      //
      // The new color model uses flat semantic keys with paired foregrounds —
      // each painted surface (e.g. `card`, `primary`, `accent`) ships with a
      // matching `*-foreground` partner. The natural way to use them in JSX:
      //   <div className="bg-primary text-primary-foreground">…</div>
      //
      // IMPORTANT — two failure modes to be aware of:
      //   1. Inventing a class name with no matching token AND no matching
      //      default Tailwind color (e.g. `bg-midnight`) produces NO CSS.
      //      This surfaces as white-on-white / invisible / unstyled elements
      //      with no console error. ALWAYS use a token key, or use a Tailwind
      //      arbitrary value for one-off colors: `bg-[#FFF000] text-black`.
      //   2. Using a default Tailwind color (e.g. `bg-slate-100`) works but
      //      bypasses the design system — the page won't re-theme when
      //      tokens change. Prefer TOKENS keys for anything palette-related;
      //      reserve defaults for structural neutrals (zinc in modals, etc).
      colors: TOKENS.colors,
      fontFamily: Object.fromEntries(
        Object.entries(TOKENS.fonts).map(([key, value]) => [key, splitFamily(value)])
      ),
      borderRadius: TOKENS.radius,
      boxShadow: TOKENS.shadows,
      // Optional categories: only pass through when the coder has added them
      // to TOKENS. This keeps Tailwind defaults intact otherwise.
      ...passthrough('fontSize'),       // text-{key}: ['size', { lineHeight, letterSpacing }]
      ...passthrough('spacing'),        // p-{key}, m-{key}, gap-{key}, w-{key}, h-{key}, ...
      ...passthrough('zIndex'),         // z-{key}
      ...passthrough('screens'),        // {key}:... responsive variants
      ...passthrough('transitionDuration'), // duration-{key}
      ...passthrough('transitionTimingFunction'), // ease-{key}
      ...passthrough('keyframes'),      // animation primitives
      ...passthrough('animation'),      // animate-{key}
      // `prose` theme is wired off TOKENS so light-mode markdown rendering
      // inherits the design system instead of fighting it. Heavy mode uses
      // <ProseBlock> + the report bridge and does not reference `prose`,
      // so the plugin's CSS is tree-shaken out of those bundles.
      typography: {
        DEFAULT: {
          css: {
            color: TOKENS.colors.foreground,
            maxWidth: 'none',
            a: { color: TOKENS.colors.primary, '&:hover': { textDecoration: 'underline' } },
            'h1, h2, h3, h4, strong': { color: TOKENS.colors.foreground },
            code: { color: TOKENS.colors.primary },
          },
        },
      },
    },
  },
  // Plugins are template invariants. Heavy mode relies on `tailwindcss-animate`
  // for Radix UI entry/exit animations (`animate-in`, `fade-in-0`, `zoom-in-95`,
  // `data-[state=open]:slide-in-from-top-2`, ...) and on `@tailwindcss/container-queries`
  // for `@container` / `@sm:` widget-level responsive layouts. `@tailwindcss/forms`
  // normalizes form-control resets. Light mode relies on `@tailwindcss/typography`
  // for `prose` long-form rendering. Adding/removing plugins is not a coder action;
  // surface in `task_done` if you believe the set is wrong.
  plugins: [typography, forms, containerQueries, animate],
};
