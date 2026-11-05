/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#071228", 900: "#0B1B3A", 800: "#12274F", 700: "#1B3668", 600: "#2B4A85" },
        gold: { 300: "#E8D08E", 400: "#D8B565", 500: "#C9A24B", 600: "#A58232", 700: "#7E6122" },
        cream: { 50: "#FDFAF2", 100: "#FAF4E4", 200: "#F0E6CC", 300: "#E2D4AE" },
        rubric: { 500: "#9A3324", 600: "#7F281C" },
        stone2: { 500: "#6B6B66", 700: "#3F3F3B" },
      },
      fontFamily: {
        display: ['Fraunces', '"Noto Serif Ethiopic"', "Georgia", "serif"],
        sans: ["Figtree", '"Noto Sans Ethiopic"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
