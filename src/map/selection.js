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
  let startIdx = null
  let endIdx = null
  let modeBar = null
  let hint = null
  let debounceTimer = null
  let _unsubscribe = null

  function notify() {
    if (startIdx !== null && endIdx !== null) {
      const [s, e] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
      const dist = Math.abs((store.state.track?.points[e]?.distance ?? 0) - (store.state.track?.points[s]?.distance ?? 0))
      if (dist < 50) {
        import('../ui/panel.js').then(m => m.showToast('This gap may not need fixing (under 50m)', 'warning'))
      }
      onSegmentChange(s, e)
    }
  }

  function activate(track) {
    map.off('click', onMapClick)

    if (!modeBar) {
      modeBar = document.createElement('div')
      modeBar.className = 'map-mode-bar'
      modeBar.innerHTML = `
        <button class="map-mode-btn active" data-mode="select">Select Gap</button>
        <button class="map-mode-btn" data-mode="draw">Draw Route</button>
      `
      document.getElementById('map').appendChild(modeBar)
      modeBar.querySelectorAll('.map-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modeBar.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
          onDrawModeToggle(btn.dataset.mode === 'draw')
        })
      })
    }

    if (!hint) {
      hint = document.createElement('div')
      hint.className = 'selection-hint'
      hint.innerHTML = `Click track to set <span class="hint-key">S</span> start and <span class="hint-key">E</span> end of broken segment`
      document.getElementById('map').appendChild(hint)
    }

    map.on('click', onMapClick)
  }

  function onMapClick(e) {
    const track = store.state.track
    if (!track) return
    const idx = nearestPointIndex(track, e.latlng)
    const pt = track.points[idx]
    const latlng = [pt.lat, pt.lng]

    if (!startMarker) {
      startIdx = idx
      startMarker = makeHandle(map, latlng, '#2563EB', 'S')
      startMarker.on('drag', ev => {
        startIdx = nearestPointIndex(track, ev.latlng)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      hint.innerHTML = `Now click to set <span class="hint-key">E</span> end point`
    } else {
      endIdx = idx
      if (endMarker) map.removeLayer(endMarker)
      endMarker = makeHandle(map, latlng, '#EF4444', 'E')
      endMarker.on('drag', ev => {
        endIdx = nearestPointIndex(track, ev.latlng)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      notify()
    }
  }

  function deactivate() {
    map.off('click', onMapClick)
    if (startMarker) { map.removeLayer(startMarker); startMarker = null }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null }
    if (modeBar) { modeBar.remove(); modeBar = null }
    if (hint) { hint.remove(); hint = null }
    startIdx = null; endIdx = null
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null }
  }

  _unsubscribe = store.subscribe(state => {
    if (state.phase === 'LOADED') activate(state.track)
    if (state.phase === 'IDLE') deactivate()
  })

  return { deactivate }
}
