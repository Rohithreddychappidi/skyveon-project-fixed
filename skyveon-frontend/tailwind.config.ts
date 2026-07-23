import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        crimson: "#E63946",
        orange: "#F5821F",
        indigo: "#2E3192",
        violet: "#4B4E9E",
        ink: "#14152B",
        slate: {
          DEFAULT: "#64748B",
          50: "#F8F9FC",
          100: "#F1F2F8",
          200: "#E5E7F0",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
      backgroundImage: {
        "chevron-warm": "linear-gradient(135deg, #E63946 0%, #F5821F 100%)",
        "chevron-cool": "linear-gradient(135deg, #4B4E9E 0%, #2E3192 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
