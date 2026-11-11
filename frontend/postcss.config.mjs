// Tailwind v4 is compiled through PostCSS. This is the documented setup and it
// resolves CSS imports such as `tw-animate-css` correctly, which the
// `@tailwindcss/turbopack` loader did not.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
