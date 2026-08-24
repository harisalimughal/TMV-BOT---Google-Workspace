/**
 * TMV Operations Dashboard - Design Tokens Primitive Definition
 * Authority file for spacing, typography, radii, elevations, motion, and colors.
 * All UI components must consume these tokens or their mapped Tailwind classes.
 */

export const TOKENS = {
  colors: {
    bg: "#F7F8FA",
    paper: "#FFFFFF",
    surface: "#F2F4F7",
    surface2: "#EAECF0",
    line: "#E6E9EF",
    lineStrong: "#D3D8E0",
    ink: "#101828",
    ink2: "#475467",
    muted: "#98A2B3",
    brand: "#1B75BC",
    brandSoft: "#EAF2FB",
    accent: "#29ABE2",
    status: {
      green: "#067647",
      greenBg: "#ECFDF3",
      amber: "#B54708",
      amberBg: "#FFFAEB",
      red: "#B42318",
      redBg: "#FEF3F2",
      purple: "#5925DC",
      purpleBg: "#F4F3FF",
      pink: "#C11574",
      pinkBg: "#FDF2FA",
      grey: "#475467",
      greyBg: "#F2F4F7"
    }
  },
  spacing: {
    0: "0px",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px"
  },
  typography: {
    fonts: {
      sans: "'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
    },
    sizes: {
      xs: "11px",
      sm: "13px",
      base: "14px",
      md: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "28px"
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeights: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5
    }
  },
  radii: {
    none: "0px",
    sm: "4px",
    md: "6px",
    default: "8px",
    lg: "12px",
    pill: "9999px"
  },
  elevation: {
    card: "0 1px 2px rgba(16, 24, 40, 0.06)",
    pop: "0 8px 24px rgba(16, 24, 40, 0.10)",
    none: "none"
  },
  motion: {
    durationFast: "120ms",
    durationBase: "200ms",
    durationExpand: "240ms",
    easing: "cubic-bezier(0.16, 1, 0.3, 1)"
  }
} as const;

export type DesignTokens = typeof TOKENS;
