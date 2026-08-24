/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Core Layout
        bg: "#F8FAFC",
        paper: "#FFFFFF",
        surface: "#F1F5F9",
        "surface-hover": "#E2E8F0",
        
        // Borders
        line: "#E2E8F0",
        "line-strong": "#CBD5E1",
        
        // Typography
        ink: "#0F172A",
        "ink-2": "#475569",
        muted: "#64748B",
        
        // Brand & Action
        brand: {
          DEFAULT: "#2563EB",
          soft: "#EFF6FF",
          dark: "#1D4ED8"
        },
        
        // Status & Accents
        status: {
          green: "#10B981",
          "green-bg": "#ECFDF5",
          amber: "#F59E0B",
          "amber-bg": "#FFFBEB",
          red: "#EF4444",
          "red-bg": "#FEF2F2",
          purple: "#8B5CF6",
          "purple-bg": "#F5F3FF",
          pink: "#EC4899",
          "pink-bg": "#FDF2F8",
          grey: "#64748B",
          "grey-bg": "#F8FAFC"
        }
      },
      fontSize: {
        // Typography System
        "hero": ["32px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "page-title": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "section-title": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "card-title": ["15px", { lineHeight: "20px", fontWeight: "600" }],
        "body": ["14px", { lineHeight: "20px", fontWeight: "450" }],
        "nav": ["13px", { lineHeight: "16px", fontWeight: "500" }],
        "btn": ["13px", { lineHeight: "16px", fontWeight: "600" }],
        "label": ["12px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.01em" }],
        "meta": ["11px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.02em" }]
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "6px",
        lg: "12px",
        xl: "16px",
        pill: "9999px"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        // Elevation System
        flat: "none",
        primary: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        floating: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }
    }
  },
  plugins: []
};
