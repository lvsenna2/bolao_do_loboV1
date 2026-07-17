import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/shared/**/*.{ts,tsx}"
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1440px",
      "2xl": "1536px"
    },
    extend: {
      colors: {
        app: {
          background: "rgb(var(--color-background) / <alpha-value>)",
          foreground: "rgb(var(--color-foreground) / <alpha-value>)",
          surface: "rgb(var(--color-surface) / <alpha-value>)",
          elevated: "rgb(var(--color-elevated) / <alpha-value>)",
          muted: "rgb(var(--color-muted) / <alpha-value>)",
          border: "rgb(var(--color-border) / <alpha-value>)"
        },
        brand: {
          blue: "#F2B91C",
          green: "#16A34A",
          gold: "#F2B91C",
          red: "#DC2626",
          midnight: "#090909"
        }
      },
      fontFamily: {
        sans: ["var(--font-geist)", "Arial", "sans-serif"]
      },
      borderRadius: {
        card: "8px",
        control: "8px",
        button: "10px",
        modal: "16px"
      },
      boxShadow: {
        soft: "0 20px 45px -24px rgb(15 23 42 / 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
