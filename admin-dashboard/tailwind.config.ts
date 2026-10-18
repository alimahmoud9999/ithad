import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1E293B',
          navyDark: '#0F172A',
          emerald: '#10B981',
          orange: '#F97316',
          amber: '#F59E0B',
          danger: '#EF4444',
          canvas: '#F8FAFC',
        },
      },
      fontFamily: {
        sans: ['Readex Pro', 'Cairo', 'Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
