// src/routing/osrm.js
const BASE = 'https://router.project-osrm.org/route/v1'
const PROFILE_MAP = { cycling: 'cycling', running: 'foot' }

export function scoreRoute(suggestedDist, gapDist) {
  if (gapDist === 0) return 0
  return Math.max(0, 1 - Math.abs(suggestedDist - gapDist) / gapDist)
}

export async function fetchOsrmRoutes(startPoint, endPoint, activityType) {
  const profile = PROFILE_MAP[activityType] ?? 'cycling'
  const coord = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`
  const url = `${BASE}/${profile}/${coord}?overview=full&geometries=geojson&alternatives=true`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No road route found — try drawing manually')
  return data.routes
}
