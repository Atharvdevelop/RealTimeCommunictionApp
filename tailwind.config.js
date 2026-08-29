/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      screens: {
        xs: '480px',
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '80%': { opacity: '0.9' },
          '100%': { transform: 'translateY(-180px) scale(1.3)', opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)' },
        },
        'sound-wave': {
          '0%, 100%': { height: '20%' },
          '50%': { height: '100%' },
        },
      },
      animation: {
        'float-up': 'float-up 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'pulse-glow': 'pulse-glow 2s infinite ease-in-out',
        'sound-wave': 'sound-wave 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
