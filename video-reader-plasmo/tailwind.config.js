/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'yt-bg': 'var(--yt-spec-base-background)',
        'yt-text': 'var(--yt-spec-text-primary)',
        'yt-secondary': 'var(--yt-spec-text-secondary)',
        'yt-border': 'var(--yt-spec-10-percent-layer)',
      }
    }
  },
  plugins: []
}
