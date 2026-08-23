/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F5F6F8",
        paper: "#FFFFFF",
        surface: "#F9FAFB",
        "surface-2": "#F3F4F6",
        line: "#E5E7EB",
        "line-strong": "#D1D5DB",
        ink: "#1A1A2E",
        "ink-2": "#6B7280",
        muted: "#9CA3AF",
        brand: {
          DEFAULT: "#3B82F6",
          soft: "#EFF6FF",
          dark: "#2563EB"
        },
        tmv: {
          blue: "#3B82F6",
          "blue-dark": "#2563EB",
          cyan: "#38BDF8"
        },
        accent: "#38BDF8",
        status: {
          green: "#10B981",
          "green-bg": "#ECFDF5",
          amber: "#F59E0B",
          "orange": "#F59E0B",
          "orange-bg": "#FFFBEB",
          "amber-bg": "#FFFBEB",
          red: "#EF4444",
          "red-bg": "#FEF2F2",
          purple: "#8B5CF6",
          "purple-bg": "#F5F3FF",
          pink: "#EC4899",
          "pink-bg": "#FDF2F8",
          grey: "#6B7280",
          "grey-bg": "#F3F4F6"
        }
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        sm: ["13px", { lineHeight: "18px", letterSpacing: "0.01em" }],
        base: ["14px", { lineHeight: "21px" }],
        md: ["15px", { lineHeight: "24px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "3xl": ["28px", { lineHeight: "36px", fontWeight: "700" }]
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "1.5": "6px",
        "2": "8px",
        "2.5": "10px",
        "3": "12px",
        "3.5": "14px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "7": "28px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "14": "56px",
        "16": "64px",
        "18": "72px",
        "20": "80px"
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        pill: "9999px"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
        pop: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        expand: "240ms"
      }
    }
  },
  plugins: []
};
