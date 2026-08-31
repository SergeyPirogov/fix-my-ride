// src/map/selection.js
import L from 'leaflet'
import { store } from '../store.js'

const DEBOUNCE_MS = 500

function nearestPointIndex(track, latlng) {
  let minDist = Infinity
  let minIdx = 0
  track.points.forEach((pt, i) => {
    const d = Math.hypot(pt.lat - latlng.lat, pt.lng - latlng.lng)
    if (d < minDist) { minDist = d; minIdx = i }
  })
  return minIdx
}

function makeHandle(map, latlng, color, label) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color};display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;font-weight:700;font-family:Inter,sans-serif">${label}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
  return L.marker(latlng, { icon, draggable: true }).addTo(map)
}

export function initSelection(map, { onSegmentChange, onDrawModeToggle }) {
  let startMarker = null
  let endMarker = null
  let startPt = null   // { lat, lng } exact
  let endPt = null     // { lat, lng } exact
  let hint = null
  let debounceTimer = null
  let _unsubscribe = null

  function updateCoordInput(id, pt) {
    const el = document.getElementById(id)
    if (el) el.value = `${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`
  }

  function notify() {
    if (startPt !== null && endPt !== null) {
      const track = store.state.track
      const sIdx = nearestPointIndex(track, startPt)
      const eIdx = nearestPointIndex(track, endPt)
      const [spliceStart, spliceEnd] = sIdx < eIdx ? [sIdx, eIdx] : [eIdx, sIdx]
      store.setState({
        segmentStart: spliceStart,
        segmentEnd: spliceEnd,
        segmentStartPt: startPt,
        segmentEndPt: endPt,
      })
      const dist = Math.hypot(
        (endPt.lat - startPt.lat) * 111320,
        (endPt.lng - startPt.lng) * 111320 * Math.cos(startPt.lat * Math.PI / 180)
      )
      if (dist < 50) {
        import('../ui/panel.js').then(m => m.showToast('Gap under 50m — may not need fixing', 'warning'))
      }
      onSegmentChange(spliceStart, spliceEnd, startPt, endPt)
    }
  }

  function setHint(text) {
    if (!hint) return
    hint.innerHTML = text
  }

  function activate() {
    map.off('click', onMapClick)
    startMarker = null; endMarker = null; startPt = null; endPt = null

    if (!hint) {
      hint = document.createElement('div')
      hint.className = 'selection-hint'
      document.getElementById('map').appendChild(hint)
    }

    const track = store.state.track
    const { segmentStartPt, segmentEndPt } = store.state
    if (track && segmentStartPt && segmentEndPt) {
      startPt = segmentStartPt
      endPt = segmentEndPt
      startMarker = makeHandle(map, [startPt.lat, startPt.lng], '#2563EB', 'S')
      startMarker.on('drag', ev => {
        startPt = { lat: ev.target.getLatLng().lat, lng: ev.target.getLatLng().lng }
        updateCoordInput('coord-start', startPt)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      endMarker = makeHandle(map, [endPt.lat, endPt.lng], '#EF4444', 'E')
      endMarker.on('drag', ev => {
        endPt = { lat: ev.target.getLatLng().lat, lng: ev.target.getLatLng().lng }
        updateCoordInput('coord-end', endPt)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      setHint(`Drag handles to adjust, or click Find Route`)
    } else {
      setHint(`Click on the map to set the <span class="hint-key">start</span> of the broken segment`)
    }

    map.on('click', onMapClick)
    store.setState({ phase: 'SELECTING' })
  }

  function onMapClick(e) {
    const track = store.state.track
    if (!track) return
    const phase = store.state.phase
    if (phase !== 'SELECTING' && phase !== 'LOADED') return

    const clicked = { lat: e.latlng.lat, lng: e.latlng.lng }
    const latlng = [clicked.lat, clicked.lng]

    if (!startMarker) {
      startPt = clicked
      startMarker = makeHandle(map, latlng, '#2563EB', 'S')
      startMarker.on('drag', ev => {
        startPt = { lat: ev.target.getLatLng().lat, lng: ev.target.getLatLng().lng }
        updateCoordInput('coord-start', startPt)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      updateCoordInput('coord-start', clicked)
      setHint(`Now click to set the <span class="hint-key">end</span> of the broken segment`)
    } else {
      endPt = clicked
      if (endMarker) map.removeLayer(endMarker)
      endMarker = makeHandle(map, latlng, '#EF4444', 'E')
      endMarker.on('drag', ev => {
        endPt = { lat: ev.target.getLatLng().lat, lng: ev.target.getLatLng().lng }
        updateCoordInput('coord-end', endPt)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      updateCoordInput('coord-end', clicked)
      notify()
    }
  }

  function deactivate() {
    map.off('click', onMapClick)
    if (startMarker) { map.removeLayer(startMarker); startMarker = null }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null }
    if (hint) { hint.remove(); hint = null }
    startPt = null; endPt = null
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null }
  }

  _unsubscribe = store.subscribe(state => {
    if (state.phase === 'LOADED') activate()
    if (state.phase === 'IDLE') deactivate()
  })

  return { deactivate }
}
