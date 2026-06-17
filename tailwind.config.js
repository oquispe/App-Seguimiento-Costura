/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#1D4ED8',
          50: '#EFF4FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#1D4ED8',
          700: '#1E3A8A',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          faint: '#94A3B8',
        },
        surface: '#F6F7F9',
        line: '#E6E9EF',
        semaforo: {
          red: '#EF4444',
          amber: '#F59E0B',
          emerald: '#10B981',
        },
        avance: {
          teal: '#0D9488',
          amber: '#D97706',
          slate: '#64748B',
        },
      },
    },
  },
  plugins: [],
}
