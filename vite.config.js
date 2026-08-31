import { defineConfig } from 'vite'

// Served at https://automation-remarks.com/fix-my-ride/ — the domain
// hosts multiple projects under path prefixes, so asset URLs need the
// /fix-my-ride/ prefix even though this isn't the default project-site
// github.io URL.
export default defineConfig({
  base: '/fix-my-ride/',
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
  },
})
