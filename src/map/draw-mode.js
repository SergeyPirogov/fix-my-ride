// src/map/draw-mode.js
import L from 'leaflet'
import { store } from '../store.js'

export function initDrawMode(map, { onRouteComplete }) {
  let waypoints = []
  let waypointMarkers = []
  let previewLine = null
  let active = false
  let finishBtn = null

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#10B981;border:2px solid #fff;box-shadow:0 0 0 1px #10B981"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })

  function onMapClick(e) {
    if (!active) return
    waypoints.push([e.latlng.lng, e.latlng.lat])
    const marker = L.marker(e.latlng, { icon }).addTo(map)
    waypointMarkers.push(marker)
    if (waypoints.length >= 2) {
      if (previewLine) map.removeLayer(previewLine)
      previewLine = L.polyline(waypoints.map(([lng, lat]) => [lat, lng]), {
        color: '#10B981', weight: 3, dashArray: '6 4',
      }).addTo(map)
    }
  }

  function deactivate() {
    active = false
    map.off('click', onMapClick)
    waypointMarkers.forEach(m => map.removeLayer(m))
    waypointMarkers = []
    waypoints = []
    if (previewLine) { map.removeLayer(previewLine); previewLine = null }
    finishBtn?.remove()
    finishBtn = null
  }

  function finish() {
    if (waypoints.length < 1) return
    const { track, segmentStart, segmentEnd } = store.state
    if (!track || segmentStart === null || segmentEnd === null) return
    const start = track.points[segmentStart]
    const end = track.points[segmentEnd]
    const full = [
      [start.lng, start.lat],
      ...waypoints,
      [end.lng, end.lat],
    ]
    deactivate()
    onRouteComplete(full)
  }

  function activate() {
    deactivate()
    active = true
    map.on('click', onMapClick)

    finishBtn = document.createElement('button')
    finishBtn.className = 'btn btn-success'
    finishBtn.style.cssText = 'position:absolute;bottom:60px;right:14px;z-index:1000'
    finishBtn.textContent = 'Finish Route'
    finishBtn.addEventListener('click', finish)
    document.getElementById('map').appendChild(finishBtn)
  }

  return { activate, deactivate }
}
