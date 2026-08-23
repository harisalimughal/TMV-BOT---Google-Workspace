/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        paper: "#FFFFFF",
        surface: "#F2F4F7",
        "surface-2": "#EAECF0",
        line: "#E6E9EF",
        "line-strong": "#D3D8E0",
        ink: "#101828",
        "ink-2": "#475467",
        muted: "#98A2B3",
        brand: {
          DEFAULT: "#1B75BC",
          soft: "#EAF2FB",
          dark: "#155E97"
        },
        tmv: {
          blue: "#1B75BC",
          "blue-dark": "#155E97",
          cyan: "#29ABE2"
        },
        accent: "#29ABE2",
        status: {
          green: "#067647",
          "green-bg": "#ECFDF3",
          amber: "#B54708",
          "orange": "#B54708",
          "orange-bg": "#FFFAEB",
          "amber-bg": "#FFFAEB",
          red: "#B42318",
          "red-bg": "#FEF3F2",
          purple: "#5925DC",
          "purple-bg": "#F4F3FF",
          pink: "#C11574",
          "pink-bg": "#FDF2FA",
          grey: "#475467",
          "grey-bg": "#F2F4F7"
        }
      },
      fontSize: {
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "36px" }]
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
        "16": "64px"
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        DEFAULT: "8px",
        lg: "12px",
        pill: "9999px"
      },
      fontFamily: {
        sans: ["Archivo", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06)",
        pop: "0 8px 24px rgba(16, 24, 40, 0.10)"
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
