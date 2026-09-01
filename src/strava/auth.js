// src/strava/auth.js
// Browser-side half of Strava OAuth. The actual token exchange (which needs
// the client secret) happens in api/strava-token.js — this module only
// redirects to Strava, captures the ?code= on return, and holds the
// resulting token in sessionStorage (cleared when the tab closes; this app
// has no server-side session and shouldn't try to persist Strava credentials
// longer than that).

const TOKEN_EXCHANGE_URL = __STRAVA_TOKEN_URL__ // injected at build time, see vite.config.js
const STRAVA_CLIENT_ID = __STRAVA_CLIENT_ID__ // injected at build time, see vite.config.js
const STORAGE_KEY = 'stravaAuth'
const SCOPE = 'read,activity:read_all,activity:write'

function currentRedirectUri() {
  // Strip any ?code=&state= from the current URL — Strava redirects back to
  // exactly this URI, so it must match what's registered in the Strava app
  // settings (including no query string).
  const url = new URL(window.location.href)
  url.search = ''
  return url.toString()
}

export function getStoredAuth() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeAuth(auth) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearStoredAuth() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function isAuthValid(auth) {
  return !!auth?.access_token && auth.expires_at * 1000 > Date.now()
}

// The token exchange response never echoes back which scopes were granted —
// only the /oauth/authorize redirect does, as a ?scope= query param. We
// capture that in handleAuthRedirect and stamp it onto the stored auth
// ourselves, since it's the only place this information exists.
export function hasUploadScope(auth) {
  return !!auth?.grantedScope?.includes('activity:write')
}

export function redirectToStravaLogin() {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: currentRedirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}

// Call once on app load. If the URL has a Strava ?code=, exchanges it for a
// token, stores it, and strips the code from the URL (so a refresh doesn't
// re-exchange it). Returns the auth object if login just completed, else null.
export async function handleAuthRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const grantedScope = url.searchParams.get('scope') ?? ''

  if (error) {
    window.history.replaceState({}, '', url.pathname)
    throw new Error(`Strava login was not completed (${error})`)
  }
  if (!code) return null

  window.history.replaceState({}, '', url.pathname)

  const res = await fetch(TOKEN_EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error('Strava login failed — could not exchange code for a token')

  const auth = { ...(await res.json()), grantedScope }
  storeAuth(auth)
  return auth
}

export async function refreshAuthIfNeeded() {
  const auth = getStoredAuth()
  if (!auth) return null
  if (isAuthValid(auth)) return auth

  const res = await fetch(TOKEN_EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  })
  if (!res.ok) { clearStoredAuth(); return null }

  const refreshed = { ...(await res.json()), grantedScope: auth.grantedScope }
  storeAuth(refreshed)
  return refreshed
}
