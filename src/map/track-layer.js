// src/map/track-layer.js
import L from 'leaflet'

const LAYER_KEY = '__trackLayers'
const FIX_LAYER_KEY = '__fixLayers'

export function renderTrack(map, track) {
  clearTrack(map)
  if (!track || track.points.length === 0) return

  const gapIdxSet = new Set()
  track.gaps.forEach(g => {
    for (let i = g.startIdx; i <= g.endIdx; i++) gapIdxSet.add(i)
  })

  let currentSegment = []
  let currentIsBroken = gapIdxSet.has(0)
  const segments = []

  track.points.forEach((pt, i) => {
    const broken = gapIdxSet.has(i)
    if (broken !== currentIsBroken && currentSegment.length > 0) {
      segments.push({ points: currentSegment, broken: currentIsBroken })
      currentSegment = []
      currentIsBroken = broken
    }
    currentSegment.push([pt.lat, pt.lng])
  })
  if (currentSegment.length > 0) segments.push({ points: currentSegment, broken: currentIsBroken })

  const layers = []
  segments.forEach(seg => {
    const line = L.polyline(seg.points, seg.broken
      ? { color: '#EF4444', weight: 3, opacity: 0.9, dashArray: '8 6' }
      : { color: '#2563EB', weight: 4, opacity: 0.9 }
    ).addTo(map)
    layers.push(line)
  })

  map[LAYER_KEY] = layers
  if (layers.length > 0) {
    const allLatLngs = track.points.map(p => [p.lat, p.lng])
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
  }
}

export function clearTrack(map) {
  const layers = map[LAYER_KEY] || []
  layers.forEach(l => map.removeLayer(l))
  map[LAYER_KEY] = []
}

// Render fix overlays: green lines for ok fixes, markers for failed
export function renderFixes(map, track, fixes) {
  clearFixes(map)
  const layers = []

  fixes.forEach(fix => {
    if (fix.status === 'ok' && fix.route) {
      const latlngs = fix.route.map(([lng, lat]) => [lat, lng])
      const line = L.polyline(latlngs, {
        color: '#10B981', weight: 5, opacity: 0.9,
      }).addTo(map)
      layers.push(line)
    } else if (fix.status === 'failed') {
      const startPt = track.points[fix.startIdx]
      const endPt = track.points[fix.endIdx]
      // Draw a straight dashed red line for failed fixes
      const line = L.polyline([[startPt.lat, startPt.lng], [endPt.lat, endPt.lng]], {
        color: '#EF4444', weight: 3, opacity: 0.7, dashArray: '6 6',
      }).addTo(map)
      layers.push(line)
    }
  })

  map[FIX_LAYER_KEY] = layers
}

export function clearFixes(map) {
  const layers = map[FIX_LAYER_KEY] || []
  layers.forEach(l => map.removeLayer(l))
  map[FIX_LAYER_KEY] = []
}

export function addSuggestionLayer(map, geoJsonCoords, color = '#F59E0B') {
  const latlngs = geoJsonCoords.map(([lng, lat]) => [lat, lng])
  const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 })
  line.addTo(map)
  return line
}

export function removeSuggestionLayer(map, layer) {
  if (layer) map.removeLayer(layer)
}
