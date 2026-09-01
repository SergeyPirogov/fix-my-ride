import { defineConfig } from 'vite'

// Production is served at https://automation-remarks.com/fix-my-ride/ — the
// domain hosts multiple projects under path prefixes, so the build needs
// that /fix-my-ride/ prefix. Local dev (vite serve) must stay at root or
// every asset request 404s against the dev server.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/fix-my-ride/' : '/',
  server: { port: 5173 },
  define: {
    // Strava's client_id is public by design (it's visible in the OAuth
    // redirect URL) — safe to bake into the client bundle at build time.
    __STRAVA_CLIENT_ID__: JSON.stringify(process.env.STRAVA_CLIENT_ID ?? ''),
    // URL of the Vercel function that holds the client secret and does the
    // actual OAuth token exchange — set once the Vercel project is live.
    __STRAVA_TOKEN_URL__: JSON.stringify(process.env.STRAVA_TOKEN_URL ?? 'https://fix-my-ride-delta.vercel.app/api/strava-token'),
  },
  test: {
    environment: 'jsdom',
  },
}))
