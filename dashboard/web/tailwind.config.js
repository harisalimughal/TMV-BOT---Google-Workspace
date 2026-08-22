/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0A1A2F",
          800: "#12263F",
          700: "#1B3355",
          600: "#25436B"
        },
        tmv: {
          blue: "#1B75BC",
          "blue-dark": "#155E97",
          cyan: "#29ABE2",
          "cyan-light": "#5EC8F0"
        },
        paper: "#FFFFFF",
        surface: "#F1F4F8",
        "surface-2": "#E7ECF3",
        line: "#DCE3EC",
        "line-strong": "#C3CEDC",
        ink: "#0F1D2E",
        "ink-2": "#3B4E63",
        muted: "#677C93",
        status: {
          green: "#17804A",
          "green-bg": "#E4F3EA",
          orange: "#B4600A",
          "orange-bg": "#FBEEDD",
          red: "#BF3025",
          "red-bg": "#FBE7E5",
          purple: "#6B46A8",
          "purple-bg": "#EFE9F8",
          pink: "#B32568",
          "pink-bg": "#FBE6EF",
          grey: "#7B8CA0",
          "grey-bg": "#EDF1F5"
        }
      },
      fontFamily: {
        sans: ["Archivo", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      },
      boxShadow: {
        paper: "0 1px 3px 0 rgba(10, 26, 47, 0.08), 0 4px 12px 0 rgba(10, 26, 47, 0.05)",
        "paper-lg": "0 4px 6px -1px rgba(10, 26, 47, 0.1), 0 10px 24px -3px rgba(10, 26, 47, 0.12)"
      }
    }
  },
  plugins: []
};
