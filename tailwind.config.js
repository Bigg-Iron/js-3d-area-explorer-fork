/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: "#00e5ff",
          green: "#39ff14",
          red: "#ff2a5f",
          purple: "#d500f9",
        },
        dark: {
          bg: "rgba(10, 15, 30, 0.45)",
          panel: "rgba(15, 23, 42, 0.65)",
        }
      },
      fontFamily: {
        space: ["'Space Grotesk'", "sans-serif"],
        inter: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 12px rgba(99, 102, 241, 0.4)",
        glass: "0 12px 40px 0 rgba(0, 0, 0, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)",
        "neon-blue": "0 0 8px #00e5ff",
        "neon-green": "0 0 8px #39ff14",
        "neon-red": "0 0 8px #ff2a5f",
      }
    },
  },
  plugins: [],
}
