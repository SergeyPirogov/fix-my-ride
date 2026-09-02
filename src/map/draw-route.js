// src/map/draw-route.js
// Lets the user build a reference route by clicking waypoints on the map.
// Each click snaps the segment from the previous waypoint to real roads via
// OSRM's free public routing API, so the drawn route follows actual paths
// instead of a straight line between clicks.
import L from 'leaflet'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const DRAW_LAYER_KEY = '__drawLayer'
const WAYPOINT_LAYER_KEY = '__drawWaypoints'

async function fetchRoadSegment(from, to, profile) {
  const url = `${OSRM_BASE}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Routing service unavailable')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No road route found between those points')
  // GeoJSON coords are [lng, lat] — Leaflet wants [lat, lng].
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
}

// activityType picks the OSRM routing profile (walking better fits running
// than the default "driving" road preference).
function profileFor(activityType) {
  return activityType === 'running' ? 'foot' : 'cycling'
}

export function startDrawingRoute(map, { activityType = 'cycling', onError } = {}) {
  const profile = profileFor(activityType)
  const waypoints = [] // [{lat, lng}] — the clicked points, before road-snapping
  const segments = [] // road-snapped [lat,lng] arrays, one per waypoint pair

  map[DRAW_LAYER_KEY] = L.polyline([], { color: '#EF4444', weight: 3, opacity: 0.85, dashArray: '8 6' }).addTo(map)
  map[WAYPOINT_LAYER_KEY] = L.layerGroup().addTo(map)

  function redraw() {
    map[DRAW_LAYER_KEY].setLatLngs(segments.flat())
  }

  async function addWaypoint(latlng) {
    const point = { lat: latlng.lat, lng: latlng.lng }
    L.circleMarker([point.lat, point.lng], {
      radius: 5, color: '#fff', weight: 2, fillColor: '#EF4444', fillOpacity: 1,
    }).addTo(map[WAYPOINT_LAYER_KEY])

    if (waypoints.length > 0) {
      const prev = waypoints[waypoints.length - 1]
      try {
        segments.push(await fetchRoadSegment(prev, point, profile))
        redraw()
      } catch (e) {
        onError?.(e.message)
        return // don't record a waypoint we couldn't connect
      }
    }
    waypoints.push(point)
  }

  function clickHandler(e) { addWaypoint(e.latlng) }
  map.on('click', clickHandler)

  return {
    // Builds a gpxTrack-shaped object: no recorded time/HR/power exist for a
    // drawn route, so those fields stay null — same as a picked Strava route.
    finish() {
      map.off('click', clickHandler)
      map.removeLayer(map[DRAW_LAYER_KEY])
      map.removeLayer(map[WAYPOINT_LAYER_KEY])
      map[DRAW_LAYER_KEY] = null
      map[WAYPOINT_LAYER_KEY] = null

      const flat = segments.flat()
      if (flat.length < 2) return null

      let cumulativeDistance = 0
      const points = flat.map(([lat, lng], i) => {
        if (i > 0) {
          const [prevLat, prevLng] = flat[i - 1]
          cumulativeDistance += map.distance([prevLat, prevLng], [lat, lng])
        }
        return { lat, lng, ele: 0, timestamp: Date.now() + i * 1000, hr: null, power: null, cadence: null, distance: Math.round(cumulativeDistance) }
      })
      return { activityType, points }
    },
    cancel() {
      map.off('click', clickHandler)
      map.removeLayer(map[DRAW_LAYER_KEY])
      map.removeLayer(map[WAYPOINT_LAYER_KEY])
      map[DRAW_LAYER_KEY] = null
      map[WAYPOINT_LAYER_KEY] = null
    },
    get waypointCount() { return waypoints.length },
  }
}
