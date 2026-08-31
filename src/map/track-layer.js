// src/map/track-layer.js
import L from 'leaflet'

const FIT_LAYER_KEY = '__fitLayer'
const GPX_LAYER_KEY = '__gpxLayer'
const FIX_LAYER_KEY = '__fixLayers'

export function renderFitTrack(map, track) {
  clearFitTrack(map)
  if (!track || track.points.length === 0) return
  const latlngs = track.points.map(p => [p.lat, p.lng])
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
  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
}

export function clearGpxTrack(map) {
  if (map[GPX_LAYER_KEY]) { map.removeLayer(map[GPX_LAYER_KEY]); map[GPX_LAYER_KEY] = null }
}

function fitBoundsToVisible(map) {
  const all = []
  if (map[FIT_LAYER_KEY]) all.push(...map[FIT_LAYER_KEY].getLatLngs())
  if (map[GPX_LAYER_KEY]) all.push(...map[GPX_LAYER_KEY].getLatLngs())
  if (all.length > 0) map.fitBounds(L.latLngBounds(all), { padding: [40, 40] })
}

// Once a fix is applied, the broken fit track is replaced on the map by the
// actual corrected route (the same points that get written to the .fit file)
// so what's visible matches what downloads — solid green, drawn over the
// hidden blue original. Gaps with no gpx match stay visible as orange
// dashed straight lines so the user can see what's still broken.
export function renderFixedTrack(map, fixedPoints, fitTrack, fixes) {
  clearFixes(map)
  clearFitTrack(map)
  const layers = []

  if (fixedPoints && fixedPoints.length > 0) {
    const latlngs = fixedPoints.map(p => [p.lat, p.lng])
    layers.push(L.polyline(latlngs, { color: '#10B981', weight: 4, opacity: 0.95 }).addTo(map))
  }

  fixes.forEach(fix => {
    if (fix.status !== 'ok') {
      const s = fitTrack.points[fix.startIdx]
      const e = fitTrack.points[fix.endIdx]
      layers.push(L.polyline([[s.lat, s.lng], [e.lat, e.lng]], {
        color: '#F59E0B', weight: 3, opacity: 0.8, dashArray: '4 4',
      }).addTo(map))
    }
  })

  map[FIX_LAYER_KEY] = layers
  if (fixedPoints && fixedPoints.length > 0) {
    map.fitBounds(L.latLngBounds(fixedPoints.map(p => [p.lat, p.lng])), { padding: [40, 40] })
  }
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
}
