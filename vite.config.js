import { defineConfig } from 'vite'

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/ —
// asset URLs need that repo-name prefix in production, but not in local dev.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/fix-my-ride/' : '/',
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
  },
})
