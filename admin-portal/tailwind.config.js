/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cofau-red': '#FF2E2E',
        'cofau-orange': '#FF7A18',
      }
    },
  },
  plugins: [],
}
