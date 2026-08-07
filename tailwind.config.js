/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 白色系：页面浅暖灰白 + 卡片纯白 + 面板暖灰白，用不同质感的白色区分层级
        primary: '#4b5563',
        'primary-light': '#9aa3ad',
        accent: '#b09878',
        danger: '#c4816b',
        'bg-page': '#f4f3f1',
        'bg-warm': '#ebe9e4',
        'bg-card': '#ffffff',
        'text-main': '#2e2e2e',
        'text-muted': '#8d8d8d',
        border: '#e5e3de',
        success: '#7a9a7e',
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 6px rgba(0,0,0,0.04)',
        pop: '0 4px 20px rgba(0,0,0,0.10)',
      },
      borderRadius: {
        card: '8px',
        btn: '6px',
        tag: '4px',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(0.97)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
