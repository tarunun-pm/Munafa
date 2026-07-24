import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-baloo)", "system-ui", "sans-serif"],
      },
      colors: {
        turmeric: {
          100: "#FCE8C4",
          500: "#F2A93B",
          600: "#DB8F1F",
        },
        "ink-green": {
          100: "#DDEDE5",
          500: "#2C7A5E",
          700: "#1B5B45",
          900: "#0F3D2E",
        },
        cream: {
          50: "#FFFBF3",
          100: "#FBF3E3",
        },
        sand: {
          200: "#EFE4CC",
        },
        charcoal: {
          800: "#2A2622",
        },
        muted: {
          500: "#8A8272",
        },
        alert: {
          500: "#C9563B",
        },
      },
      maxWidth: {
        mobile: "390px",
      },
    },
  },
  plugins: [],
};

export default config;
