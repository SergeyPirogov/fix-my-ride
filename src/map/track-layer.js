// src/map/track-layer.js
import L from 'leaflet'

const LAYER_KEY = '__trackLayers'

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

export function addSuggestionLayer(map, geoJsonCoords, color = '#10B981') {
  const latlngs = geoJsonCoords.map(([lng, lat]) => [lat, lng])
  const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 })
  line.addTo(map)
  return line
}

export function removeSuggestionLayer(map, layer) {
  if (layer) map.removeLayer(layer)
}
