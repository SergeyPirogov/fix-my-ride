import { defineConfig } from 'vite'

// Served from a custom domain (automation-remarks.com) at the root, not
// under /fix-my-ride/ — no base prefix needed for GitHub Pages here.
export default defineConfig({
  base: '/',
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
  },
})
