/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lumina: {
          bg: '#FAFAFA',
          surface: '#FFFFFF',
          border: '#E5E5E5',
          'border-light': '#F0F0F0',
          text: '#1A1A1A',
          'text-secondary': '#6B7280',
          accent: '#7C3AED',
          'accent-light': '#EDE9FE',
          success: '#10B981',
          'success-light': '#D1FAE5',
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          danger: '#EF4444',
          'danger-light': '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'float': '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
