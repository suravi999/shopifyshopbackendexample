/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#6BA24A",
          greenDark: "#56853C",
          cream: "#F6F6E8",
        },
        ink: { 900: "#262626", 700: "#4A4A4A", 500: "#777777" },
      },
      boxShadow: {
        card: "0 3px 0 rgba(0,0,0,.08), 0 1px 12px rgba(0,0,0,.06)",
      },
      borderRadius: { card: "16px" },
    },
  },
  plugins: [],
};
