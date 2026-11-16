/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          canvas: "#F5F5F7",
          card: "#FFFFFF",
          surface: "#F0F0F2",
          border: "#E5E5EA",
          blue: "#0071E3",
          blueHover: "#0077ED",
          purple: "#5856D6",
          green: "#34C759",
          orange: "#FF9500",
          red: "#FF3B30",
          label: "#1D1D1F",
          secondary: "#86868B",
          tertiary: "#A1A1A6"
        }
      },
      fontFamily: {
        khmer: ['"Kantumruy Pro"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Kantumruy Pro"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      borderRadius: {
        'squircle': '18px',
        'apple-btn': '10px'
      },
      boxShadow: {
        'apple-subtle': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'apple-card': '0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
        'apple-sheet': '0 20px 40px -10px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.04)'
      }
    },
  },
  plugins: [],
}
