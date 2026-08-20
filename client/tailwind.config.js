/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#050505',
        aurora: {
          300: '#7cf7c6',
          400: '#42f596',
          500: '#20d6a8',
          600: '#10a0be',
          700: '#4a4a6a',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        float: 'float 8s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'pulse-ring': 'pulseRing 3.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.55', filter: 'blur(60px)' },
          '50%': { opacity: '0.9', filter: 'blur(80px)' },
        },
        pulseRing: {
          '0%, 100%': {
            boxShadow:
              '0 0 0 0 rgba(66,245,150,0.25), 0 0 40px 6px rgba(66,245,150,0.28)',
            borderColor: 'rgba(66,245,150,0.45)',
          },
          '50%': {
            boxShadow:
              '0 0 0 14px rgba(66,245,150,0), 0 0 90px 18px rgba(66,245,150,0.42)',
            borderColor: 'rgba(66,245,150,0.75)',
          },
        },
      },
      boxShadow: {
        glow: '0 0 40px 6px rgba(66, 245, 150, 0.35)',
        'glow-lg': '0 0 80px 12px rgba(66, 245, 150, 0.45)',
      },
    },
  },
  plugins: [],
};
