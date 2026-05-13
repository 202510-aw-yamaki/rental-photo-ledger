import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', "system-ui", "sans-serif"]
      },
      colors: {
        ledger: {
          ink: "#17211f",
          muted: "#5f6f6a",
          line: "#d9e2df",
          paper: "#f7faf9",
          surface: "#ffffff",
          primary: "#0f766e",
          primaryDark: "#115e59",
          accent: "#2563eb",
          warn: "#b45309"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
