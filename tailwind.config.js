/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'spin': 'spin 1s linear infinite',
        'bounce': 'bounce 1s infinite',
        'fall': 'fall 2s linear forwards',
      },
      keyframes: {
        spin: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        bounce: {
          '0%, 100%': { 
            transform: 'translateY(-10%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)'
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)'
          }
        },
        fall: {
          '0%': { 
            transform: 'translateY(-5vh) rotate(0deg)',
            opacity: 1
          },
          '100%': {
            transform: 'translateY(100vh) rotate(360deg)',
            opacity: 0
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        // Sonic theme colors
        'sonic-blue': '#2561e5',
        'sonic-blue-dark': '#1a47b8',
        'sonic-green': '#2dc36a',
        'sonic-green-dark': '#25a359',
        'sonic-red': '#f44336',
        'sonic-red-dark': '#d32f2f',
        'sonic-yellow': '#ffc107',
      },
    },
  },
  plugins: [],
};