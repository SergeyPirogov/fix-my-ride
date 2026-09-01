// api/strava-token.js
// Vercel serverless function — the only place the Strava client secret lives.
// Exchanges an OAuth authorization code (or a refresh token) for an access
// token and hands back only what the browser needs: access_token,
// refresh_token, and expires_at. Never forwards the client secret itself.

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://automation-remarks.com'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  withCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { code, refresh_token } = req.body ?? {}
  if (!code && !refresh_token) {
    res.status(400).json({ error: 'Missing code or refresh_token' })
    return
  }

  const params = {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    ...(code
      ? { code, grant_type: 'authorization_code' }
      : { refresh_token, grant_type: 'refresh_token' }),
  }

  try {
    const stravaRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await stravaRes.json()

    if (!stravaRes.ok) {
      res.status(stravaRes.status).json({ error: data.message || 'Strava token exchange failed' })
      return
    }

    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete ?? null,
    })
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Strava' })
  }
}
