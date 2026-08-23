/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F4F7FE",
        paper: "#FFFFFF",
        surface: "#F4F7FE",
        "surface-2": "#E2E8F0",
        line: "#E2E8F0",
        "line-strong": "#CBD5E1",
        ink: "#2B3674",
        "ink-2": "#707EAE",
        muted: "#A3AED0",
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
          green: "#05CD99",
          "green-bg": "#E6FAF5",
          amber: "#FFCE20",
          "orange": "#FFCE20",
          "orange-bg": "#FFFBEB",
          "amber-bg": "#FFFBEB",
          red: "#EE5D50",
          "red-bg": "#FEECEB",
          purple: "#7390FF",
          "purple-bg": "#F4F7FE",
          pink: "#E31A1A",
          "pink-bg": "#FCE8E8",
          grey: "#707EAE",
          "grey-bg": "#F4F7FE"
        }
      },
      fontSize: {
        xs: ["12px", { lineHeight: "18px", fontWeight: "500" }],
        sm: ["14px", { lineHeight: "20px", fontWeight: "500" }],
        base: ["15px", { lineHeight: "24px", fontWeight: "500" }],
        md: ["16px", { lineHeight: "26px", fontWeight: "500" }],
        lg: ["18px", { lineHeight: "28px", fontWeight: "700" }],
        xl: ["24px", { lineHeight: "32px", fontWeight: "700" }],
        "2xl": ["28px", { lineHeight: "36px", fontWeight: "700" }],
        "3xl": ["34px", { lineHeight: "42px", fontWeight: "700" }]
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
        sm: "8px",
        md: "12px",
        DEFAULT: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "30px",
        pill: "9999px"
      },
      fontFamily: {
        sans: ["DM Sans", "Archivo", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      },
      boxShadow: {
        card: "0px 18px 40px rgba(112, 144, 176, 0.12)",
        pop: "0px 20px 50px rgba(112, 144, 176, 0.18)"
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
