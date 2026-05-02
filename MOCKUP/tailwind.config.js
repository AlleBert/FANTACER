/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        'open-sauce': ['"Open Sauce One"', 'sans-serif'],
      },
      colors: {
        /* FANTACER Brand Palette */
        'fantacer-white': '#ffffff',
        'fantacer-black': '#231f20',
        'fantacer-orange': '#ff8a26',
        'fantacer-orange-dark': '#ff803b',
        'fantacer-yellow': '#fccb27',
        'fantacer-yellow-hover': '#c99900',
        'fantacer-purple': '#8000ff',
        'fantacer-purple-dark': '#4f03aa',
        'fantacer-blue': '#c2e1ff',
        'fantacer-blue-hover': '#a8c7e6',
        'fantacer-gray': '#575254',
      },
      backgroundImage: {
        /* Gradient transitions between sections */
        'gradient-white-to-orange': 'linear-gradient(180deg, #ffffff 0%, #ff8a26 100%)',
        'gradient-orange-to-white': 'linear-gradient(180deg, #ff8a26 0%, #ffffff 100%)',
        'gradient-white-to-purple': 'linear-gradient(180deg, #ffffff 0%, #4f03aa 100%)',
        'gradient-purple-to-white': 'linear-gradient(180deg, #4f03aa 0%, #ffffff 100%)',
      },
    },
  },
  plugins: [],
};