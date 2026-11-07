import type { Config } from "tailwindcss";
import { colors, verdictColors } from "./src/theme/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ...colors, verdict: verdictColors },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "Georgia", "serif"],
      },
      borderRadius: { card: "14px" },
      maxWidth: { content: "1440px" },
      boxShadow: { glow: "inset 0 0 0 1px rgba(201,130,46,0.35), inset 0 0 40px rgba(201,130,46,0.08)" },
    },
  },
  plugins: [],
} satisfies Config;
