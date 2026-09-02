// src/map/track-layer.js
import L from 'leaflet'

const FIT_LAYER_KEY = '__fitLayer'
const GPX_LAYER_KEY = '__gpxLayer'
const FIX_LAYER_KEY = '__fixLayers'

export function renderFitTrack(map, track) {
  clearFitTrack(map)
  if (!track || track.points.length === 0) return
  // Records through a GPS dropout carry null lat/lng (kept for their HR/power
  // data — see fit-parser.js) — skip them here so the polyline doesn't jump
  // through [null, null].
  const latlngs = track.points.filter(p => p.lat != null && p.lng != null).map(p => [p.lat, p.lng])
  if (latlngs.length === 0) return
  map[FIT_LAYER_KEY] = L.polyline(latlngs, { color: '#2563EB', weight: 4, opacity: 0.9 }).addTo(map)
  fitBoundsToVisible(map)
}

export function clearFitTrack(map) {
  if (map[FIT_LAYER_KEY]) { map.removeLayer(map[FIT_LAYER_KEY]); map[FIT_LAYER_KEY] = null }
}

export function renderGpxTrack(map, track) {
  clearGpxTrack(map)
  if (!track || track.points.length === 0) return
  const latlngs = track.points.map(p => [p.lat, p.lng])
  map[GPX_LAYER_KEY] = L.polyline(latlngs, { color: '#EF4444', weight: 3, opacity: 0.85, dashArray: '8 6' }).addTo(map)
  // Center on the reference route itself — the broken fit track can have
  // wild GPS jumps that would zoom the view out far past the real route.
  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], animate: false })
}

export function clearGpxTrack(map) {
  if (map[GPX_LAYER_KEY]) { map.removeLayer(map[GPX_LAYER_KEY]); map[GPX_LAYER_KEY] = null }
}

function fitBoundsToVisible(map) {
  const all = []
  if (map[FIT_LAYER_KEY]) all.push(...map[FIT_LAYER_KEY].getLatLngs())
  if (map[GPX_LAYER_KEY]) all.push(...map[GPX_LAYER_KEY].getLatLngs())
  if (all.length > 0) map.fitBounds(L.latLngBounds(all), { padding: [40, 40], animate: false })
}

// Once a fix is applied, the broken fit track is replaced on the map by the
// actual corrected route (the same points that get written to the .fit file)
// so what's visible matches what downloads — solid green, drawn over the
// hidden blue original.
export function renderFixedTrack(map, fixedPoints) {
  clearFixes(map)
  clearFitTrack(map)
  if (!fixedPoints || fixedPoints.length === 0) return

  const latlngs = fixedPoints.map(p => [p.lat, p.lng])
  map[FIX_LAYER_KEY] = [L.polyline(latlngs, { color: '#10B981', weight: 4, opacity: 0.95 }).addTo(map)]
  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], animate: false })
}

export function clearFixes(map) {
  const layers = map[FIX_LAYER_KEY] || []
  layers.forEach(l => map.removeLayer(l))
  map[FIX_LAYER_KEY] = []
}

export function clearAll(map) {
  clearFitTrack(map)
  clearGpxTrack(map)
  clearFixes(map)
  clearScrubMarker(map)
}

const SCRUB_MARKER_KEY = '__scrubMarker'

// Shows a marker on the fixed route at the point currently scrubbed in the
// analysis panel below the map — lets hovering a chart highlight where that
// moment happened geographically.
export function showScrubMarker(map, latlng) {
  const point = [latlng.lat, latlng.lng]
  if (!map[SCRUB_MARKER_KEY]) {
    map[SCRUB_MARKER_KEY] = L.circleMarker(point, {
      radius: 7,
      color: '#fff',
      weight: 2.5,
      fillColor: '#0F172A',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map)
  } else {
    map[SCRUB_MARKER_KEY].setLatLng(point)
  }
}

export function clearScrubMarker(map) {
  if (map[SCRUB_MARKER_KEY]) { map.removeLayer(map[SCRUB_MARKER_KEY]); map[SCRUB_MARKER_KEY] = null }
}
