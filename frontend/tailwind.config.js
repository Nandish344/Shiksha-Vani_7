/** Palette taken from the SIH deck (forest green, marigold, clay red) and named after what they are. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sal: { 50: '#EEF5F0', 100: '#DCEBE3', 200: '#B9D7C8', 300: '#8DBBA5', 400: '#4F9478', 500: '#23745A', 600: '#1A5F49', 700: '#14503F', 800: '#0E3B32', 900: '#092A24' },
        mahua: { 100: '#FCEFCB', 200: '#F9E0A0', 300: '#F5CB68', 400: '#F2B035', 500: '#E19A12', 600: '#B9800F', 700: '#8A5F0B' },
        madder: { 50: '#FCEEEA', 100: '#F8DDD6', 300: '#E58F7E', 500: '#C2412D', 600: '#A63523', 700: '#832A1C' },
        river: { 50: '#EAF3F9', 100: '#DCEAF3', 500: '#2B6A94', 700: '#1E4D6E' },
        ink: '#10241E',
        mist: '#5C706A',
        line: '#D5E1DA',
        paper: '#F1F5EF',
      },
      fontFamily: {
        display: ['"Baloo 2"', '"Noto Sans Devanagari"', '"Noto Sans Bengali"', '"Noto Sans Oriya"', '"Noto Sans Ol Chiki"', 'system-ui', 'sans-serif'],
        body: ['Hind', '"Noto Sans Devanagari"', '"Noto Sans Bengali"', '"Noto Sans Oriya"', '"Noto Sans Ol Chiki"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { chunk: '22px', hero: '32px' },
      boxShadow: {
        press: '0 4px 0 0 var(--press, #092A24)',
        card: '0 1px 0 0 rgba(14,59,50,.06), 0 8px 24px -12px rgba(14,59,50,.18)',
      },
    },
  },
  plugins: [],
}
