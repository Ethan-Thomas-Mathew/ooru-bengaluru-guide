// ---------------------------------------------------------------
// demo.ts
// The GitHub Pages demo is built with VITE_DEMO=1 (see
// .github/workflows/pages.yml). GitHub Pages only serves files: there
// is no Express server, so reviews and admin are switched off and the
// site uses the data built into it.
// ---------------------------------------------------------------

export const DEMO = import.meta.env.VITE_DEMO === '1'

/** Shown wherever a feature needs the server */
export const DEMO_MESSAGE =
  'This is the GitHub Pages demo, which has no server, so reviews and admin are turned off. Run the project locally to try them.'
