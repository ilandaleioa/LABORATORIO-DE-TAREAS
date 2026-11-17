/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '9999px' },
    extend: {
      colors: {
        athletic: { DEFAULT: '#d3291e', dark: '#b6170d', light: '#fdeceb' },
        ink: '#1b2026',
        surface: '#f6f5f2',
        line: '#e7e5e1',
      },
      fontFamily: {
        sans: ['Akrobat', 'DIN PRO', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: 'none',
        lift: '0 10px 24px -12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
