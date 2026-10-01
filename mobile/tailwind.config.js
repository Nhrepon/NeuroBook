/** @type {import('tailwindcss').Config} */
const { hairlineWidth } = require('nativewind/theme')

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { borderWidth: { hairline: hairlineWidth() } } },
  plugins: [],
}
