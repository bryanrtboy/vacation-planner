import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#232323",
        paper: "#fbfaf7",
        mist: "#e8eef0",
        moss: "#53685a",
        clay: "#9b6048",
        saffron: "#c8963e",
        harbor: "#2f6773"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(35, 35, 35, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
