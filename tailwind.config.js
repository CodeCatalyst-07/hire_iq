/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8F9FA',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        primary: '#7C3AED',
        secondary: '#6B7280', 
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
