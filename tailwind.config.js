/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#3C78A0',
          'blue-dark': '#2C5F80',
          'blue-light': '#5A96BE',
          'blue-pale': '#A0C8DC',
          green: '#A0B464',
          'green-dark': '#7A8C44',
          'green-light': '#C0CC84',
          'green-pale': '#E8F0C8',
        },
        sidebar: '#0F1A24',
      }
    },
  },
  plugins: [],
}
