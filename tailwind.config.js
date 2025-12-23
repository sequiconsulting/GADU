export default {
  content: [
    './index.html',
    './*.tsx',
    './components/**/*.tsx',
    './contexts/**/*.tsx',
    './utils/**/*.ts',
    './services/**/*.ts'
  ],
  safelist: [
    'bg-masonic-blue',
    'bg-masonic-red',
    'bg-masonic-mark',
    'bg-masonic-ram',
    'bg-masonic-gold',
    'bg-masonic-dark',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Cinzel', 'serif'],
      },
      colors: {
        masonic: {
          blue: '#1e3a8a',
          red: '#991b1b',
          mark: '#b45309',
          ram: '#0f766e',
          gold: '#cca300',
          dark: '#0f172a',
        }
      }
    },
  },
  plugins: [],
}
