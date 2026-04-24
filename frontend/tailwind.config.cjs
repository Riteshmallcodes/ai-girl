module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        night: '#0b0b12',
        dusk: '#131427',
        neon: '#ff5ea8',
        ice: '#7be7ff',
        glow: '#ffd66e'
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"Space Grotesk"', 'sans-serif']
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(255, 94, 168, 0)' },
          '50%': { boxShadow: '0 0 30px rgba(255, 94, 168, 0.45)' }
        }
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.5s ease-in-out infinite'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
