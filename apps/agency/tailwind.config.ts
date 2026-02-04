import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#3B0764',
        },
        sidebar: {
          DEFAULT: '#1E1E2D',
          hover: '#2D2D3F',
          active: '#7C3AED',
        },
        background: '#F5F5F5',
        card: '#FFFFFF',
        success: '#52B788',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      fontSize: {
        // Fluid typography using clamp
        'fluid-xs': 'clamp(0.625rem, 0.5rem + 0.25vw, 0.75rem)',
        'fluid-sm': 'clamp(0.75rem, 0.65rem + 0.25vw, 0.875rem)',
        'fluid-base': 'clamp(0.8125rem, 0.7rem + 0.3vw, 1rem)',
        'fluid-lg': 'clamp(0.875rem, 0.75rem + 0.35vw, 1.125rem)',
        'fluid-xl': 'clamp(1rem, 0.85rem + 0.4vw, 1.25rem)',
        'fluid-2xl': 'clamp(1.125rem, 0.95rem + 0.5vw, 1.5rem)',
      },
      spacing: {
        // Fluid spacing
        'fluid-1': 'clamp(0.125rem, 0.1rem + 0.1vw, 0.25rem)',
        'fluid-2': 'clamp(0.25rem, 0.2rem + 0.15vw, 0.5rem)',
        'fluid-3': 'clamp(0.5rem, 0.4rem + 0.25vw, 0.75rem)',
        'fluid-4': 'clamp(0.75rem, 0.6rem + 0.35vw, 1rem)',
        'fluid-6': 'clamp(1rem, 0.8rem + 0.5vw, 1.5rem)',
      },
    },
  },
  plugins: [],
}

export default config
