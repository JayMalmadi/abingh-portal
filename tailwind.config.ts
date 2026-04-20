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
        coral: {
          DEFAULT: '#e8622a',
          dark: '#cf4f1e',
          light: '#fdf0ea',
        },
        teal: {
          sidebar: '#a8d8d4',
          'sidebar-dark': '#90ceca',
          text: '#134e4a',
          'text-mid': '#1e5e59',
          muted: '#4a8a85',
          label: '#3d7a76',
          mid: '#0f766e',
        },
      },
    },
  },
  plugins: [],
}
export default config
