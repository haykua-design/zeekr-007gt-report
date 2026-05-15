/**
 * Design Tokens for Zeekr 007GT Buying Decision Report
 * Follows the /UI-decision.md contract.
 */

export const tokens = {
  colors: {
    // Core paired tokens
    background: "#F8F9FA",
    "background-foreground": "#0F172A",
    
    card: "#FFFFFF",
    "card-foreground": "#0F172A",
    
    primary: "#0052FF", // Electric Blue
    "primary-foreground": "#FFFFFF",
    
    accent: "#FF6B00", // Warning Orange
    "accent-foreground": "#FFFFFF",
    
    muted: "#F1F5F9",
    "muted-foreground": "#64748B",
    
    // Technical Panels
    "dark-panel": "#0F172A",
    "dark-panel-foreground": "#F8F9FA",
    
    // Border & Separator
    border: "#E2E8F0",
    input: "#E2E8F0",
  },
  
  fonts: {
    sans: [
      'Inter',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ],
    mono: [
      'JetBrains Mono',
      'Fira Code',
      'monospace',
    ],
  },
  
  typography: {
    fontSize: {
      hero: ["4.5rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "800" }],
      display: ["3rem", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "700" }],
      h1: ["2.25rem", { lineHeight: "1.2", letterSpacing: "0", fontWeight: "700" }],
      h2: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
      body: ["1rem", { lineHeight: "1.6" }],
      caption: ["0.875rem", { lineHeight: "1.4" }],
      tiny: ["0.75rem", { lineHeight: "1.2" }],
    },
  },
  
  spacing: {
    section: "7.5rem", // 120px
    block: "3rem",    // 48px
    gap: "1.5rem",    // 24px
  },
  
  shadows: {
    card: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "card-hover": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },
  
  animations: {
    keyframes: {
      "number-scroll": {
        "0%": { transform: "translateY(20%)", opacity: "0" },
        "100%": { transform: "translateY(0)", opacity: "1" },
      },
    },
    timing: {
      fast: "150ms",
      base: "300ms",
      slow: "600ms",
    },
  },
};

export const TOKENS = {
  colors: tokens.colors,
  fonts: {
    body: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    sans: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    mono: '"JetBrains Mono", "Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  radius: {
    DEFAULT: "0.5rem",
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.5rem",
  },
  shadows: tokens.shadows,
  fontSize: tokens.typography.fontSize,
  spacing: tokens.spacing,
  transitionDuration: {
    fast: tokens.animations.timing.fast,
    base: tokens.animations.timing.base,
    slow: tokens.animations.timing.slow,
  },
  transitionTimingFunction: {
    precision: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  keyframes: {
    "number-scroll": tokens.animations.keyframes["number-scroll"],
    "fade-up": {
      "0%": { opacity: "0", transform: "translateY(16px)" },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
  },
  animation: {
    "fade-up": "fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
  },
};
