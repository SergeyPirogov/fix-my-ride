// src/strava/api.js
// Direct browser calls to the Strava REST API using the bearer token from
// auth.js. Strava's API allows authenticated requests straight from the
// browser (no proxy needed here — only the OAuth token exchange itself
// needs the backend, since that's the step requiring the client secret).

const BASE = 'https://www.strava.com/api/v3'

async function stravaFetch(path, accessToken) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new Error('Strava session expired — please log in again')
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json()
}

export async function fetchActivities(accessToken, { page = 1, perPage = 30 } = {}) {
  const activities = await stravaFetch(`/athlete/activities?page=${page}&per_page=${perPage}`, accessToken)
  return activities.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    distanceM: a.distance,
    startDate: a.start_date,
    hasGpsGap: a.distance > 0 && a.map?.summary_polyline === '', // heuristic surfaced to caller
  }))
}

export async function fetchRoutes(accessToken, athleteId, { page = 1, perPage = 30 } = {}) {
  return stravaFetch(`/athletes/${athleteId}/routes?page=${page}&per_page=${perPage}`, accessToken)
    .then(routes => routes.map(r => ({
      id: r.id,
      name: r.name,
      distanceM: r.distance,
      type: r.type, // 1 = ride, 2 = run
    })))
}

// Streams give raw lat/lng + time + distance + altitude arrays for an
// activity — this is what becomes the "fit track" (broken) points.
export async function fetchActivityStreams(accessToken, activityId) {
  const keys = 'latlng,time,altitude,distance,heartrate,watts,cadence'
  const data = await stravaFetch(`/activities/${activityId}/streams?keys=${keys}&key_by_type=true`, accessToken)
  return streamsToPoints(data)
}

// Routes don't have recorded streams (they're planned, not ridden) but
// expose the same latlng/altitude/distance shape via /route/{id}/streams.
export async function fetchRouteStreams(accessToken, routeId) {
  const data = await stravaFetch(`/routes/${routeId}/streams`, accessToken)
  return streamsToPoints(data, { noTimestamp: true })
}

function streamsToPoints(streams, { noTimestamp = false } = {}) {
  const latlng = streams.latlng?.data ?? []
  const altitude = streams.altitude?.data ?? []
  const distance = streams.distance?.data ?? []
  const time = streams.time?.data ?? []
  const heartrate = streams.heartrate?.data ?? []
  const watts = streams.watts?.data ?? []
  const cadence = streams.cadence?.data ?? []

  if (latlng.length === 0) throw new Error('This activity has no GPS data')

  const baseTs = Date.now()
  return latlng.map((pair, i) => ({
    lat: pair[0],
    lng: pair[1],
    ele: altitude[i] ?? 0,
    distance: distance[i] ?? 0,
    timestamp: noTimestamp ? baseTs + (distance[i] ?? 0) * 200 : baseTs + (time[i] ?? i) * 1000,
    hr: heartrate[i] ?? null,
    power: watts[i] ?? null,
    cadence: cadence[i] ?? null,
  }))
}
