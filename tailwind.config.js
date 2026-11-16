/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        athletic: { DEFAULT: '#d3291e', dark: '#b6170d', light: '#fdeceb' },
        ink: '#1b2026',
        surface: '#f6f6f7',
        line: '#dcdde0',
      },
      fontFamily: {
        sans: ['DIN PRO', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,32,38,0.04), 0 4px 14px -6px rgba(27,32,38,0.10)',
        lift: '0 2px 4px rgba(27,32,38,0.05), 0 14px 30px -10px rgba(27,32,38,0.22)',
      },
    },
  },
  plugins: [],
}
