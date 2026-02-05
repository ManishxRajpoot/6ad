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
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',  // Professional teal
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        sidebar: {
          DEFAULT: '#1E293B',  // Slate-800
          hover: '#334155',    // Slate-700
          active: '#0F766E',   // Teal-700
        },
        background: '#F8FAFC',  // Slate-50
        card: '#FFFFFF',
        success: '#10B981',    // Emerald
        warning: '#F59E0B',    // Amber
        danger: '#EF4444',     // Red
        info: '#0EA5E9',       // Sky
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
