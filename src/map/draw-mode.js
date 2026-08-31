// src/map/draw-mode.js
import L from 'leaflet'
import { store } from '../store.js'
import { fetchOsrmLeg } from '../routing/osrm.js'

export function initDrawMode(map, { onRouteComplete }) {
  let clickPoints = []       // [{lat,lng}] — raw clicked waypoints, in order
  let snappedLegs = []       // [[lng,lat][]] — one road-snapped leg per gap between points
  let waypointMarkers = []
  let routeLine = null
  let active = false
  let finishBtn = null
  let statusEl = null
  let fetchSeq = 0           // guards against out-of-order OSRM responses
  let pendingLegFetches = 0  // count of in-flight snapLastLeg() calls

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#10B981;border:2px solid #fff;box-shadow:0 0 0 1px #10B981"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })

  function redrawLine() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null }
    const allCoords = snappedLegs.flat() // [lng,lat][]
    if (allCoords.length < 2) return
    routeLine = L.polyline(allCoords.map(([lng, lat]) => [lat, lng]), {
      color: '#10B981', weight: 4, opacity: 0.9,
    }).addTo(map)
  }

  async function snapLastLeg() {
    const track = store.state.track
    if (!track || clickPoints.length < 1) return
    const prevPt = clickPoints.length >= 2 ? clickPoints[clickPoints.length - 2] : store.state.segmentStartPt
    const newPt = clickPoints[clickPoints.length - 1]
    if (!prevPt) return

    const legIdx = snappedLegs.length
    const mySeq = ++fetchSeq
    pendingLegFetches++
    if (statusEl) statusEl.textContent = 'Snapping to road…'
    try {
      const coords = await fetchOsrmLeg(prevPt, newPt, track.activityType)
      if (mySeq !== fetchSeq) return // a newer click superseded this fetch
      snappedLegs[legIdx] = coords
    } catch (e) {
      if (mySeq !== fetchSeq) return
      // Fall back to a straight line for this leg if OSRM can't route it
      snappedLegs[legIdx] = [[prevPt.lng, prevPt.lat], [newPt.lng, newPt.lat]]
    } finally {
      pendingLegFetches--
    }
    if (statusEl && mySeq === fetchSeq) statusEl.textContent = ''
    redrawLine()
  }

  function onMapClick(e) {
    if (!active) return
    const pt = { lat: e.latlng.lat, lng: e.latlng.lng }
    clickPoints.push(pt)
    const marker = L.marker(e.latlng, { icon }).addTo(map)
    waypointMarkers.push(marker)
    snapLastLeg()
  }

  function deactivate() {
    active = false
    map.off('click', onMapClick)
    waypointMarkers.forEach(m => map.removeLayer(m))
    waypointMarkers = []
    clickPoints = []
    snappedLegs = []
    if (routeLine) { map.removeLayer(routeLine); routeLine = null }
    finishBtn?.remove()
    finishBtn = null
    statusEl?.remove()
    statusEl = null
  }

  async function finish() {
    const { track, segmentStartPt, segmentEndPt } = store.state
    if (!track || !segmentStartPt || !segmentEndPt) return

    if (finishBtn) finishBtn.disabled = true
    if (statusEl) statusEl.textContent = 'Finishing up…'
    while (pendingLegFetches > 0) await new Promise(r => setTimeout(r, 100))

    // Snap the closing leg from the last waypoint (or start) to the end point
    const lastPt = clickPoints.length > 0 ? clickPoints[clickPoints.length - 1] : segmentStartPt
    if (statusEl) statusEl.textContent = 'Snapping final leg…'
    let closingLeg
    try {
      closingLeg = await fetchOsrmLeg(lastPt, segmentEndPt, track.activityType)
    } catch (e) {
      closingLeg = [[lastPt.lng, lastPt.lat], [segmentEndPt.lng, segmentEndPt.lat]]
    }

    const full = [...snappedLegs.flat(), ...closingLeg]
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

    statusEl = document.createElement('div')
    statusEl.className = 'draw-mode-status'
    statusEl.style.cssText = 'position:absolute;bottom:100px;right:14px;z-index:1000;font-size:11px;color:var(--text-3);background:var(--surface);padding:4px 8px;border-radius:6px;'
    document.getElementById('map').appendChild(statusEl)
  }

  return { activate, deactivate }
}
