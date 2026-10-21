import type { Config } from 'tailwindcss';

// Tokens mirror the Modernist design system (styles.css).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f3f2f2',
        surface: '#eae9e9',
        ink: '#201e1d',
        divider: 'rgb(32 30 29 / 0.4)',
        accent: {
          DEFAULT: '#ec3013',
          100: '#fff2ef', 200: '#ffe0d9', 300: '#ffc4b8', 400: '#ff9783', 500: '#ff563c',
          600: '#dd2b0f', 700: '#ae1800', 800: '#7c1405', 900: '#4d170e',
        },
        neutral: {
          100: '#f8f4f4', 200: '#eae7e7', 300: '#d7d3d3', 400: '#bab6b6', 500: '#9b9797',
          600: '#7d7979', 700: '#605d5d', 800: '#444141', 900: '#2d2b2b',
        },
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        hop: { '0%, 100%': { transform: 'translateY(0)' }, '40%': { transform: 'translateY(-6px)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translateY(-8px) rotate(var(--r, 0deg))' },
        },
      },
      animation: {
        hop: 'hop .9s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
