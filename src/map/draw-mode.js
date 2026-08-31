// src/map/draw-mode.js
import L from 'leaflet'

export function initDrawMode(map, { onRouteComplete }) {
  let waypoints = []
  let waypointMarkers = []
  let previewLine = null
  let active = false
  let finishBtn = null
  let _startPt = null
  let _endPt = null
  let _gapIdx = null

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#F59E0B;border:2px solid #fff;box-shadow:0 0 0 1px #F59E0B"></div>',
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
        color: '#F59E0B', weight: 3, dashArray: '6 4',
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
    _startPt = null
    _endPt = null
    _gapIdx = null
  }

  function finish() {
    if (waypoints.length < 1) return
    if (!_startPt || !_endPt) return
    const full = [
      [_startPt.lng, _startPt.lat],
      ...waypoints,
      [_endPt.lng, _endPt.lat],
    ]
    const gapIdx = _gapIdx
    deactivate()
    onRouteComplete(full, gapIdx)
  }

  function activate(startPt, endPt, gapIdx) {
    deactivate()
    _startPt = startPt
    _endPt = endPt
    _gapIdx = gapIdx
    active = true
    waypoints = []
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
