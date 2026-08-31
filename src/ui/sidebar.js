// src/ui/sidebar.js
import { store } from '../store.js'

let _unsubscribe = null

export function initSidebar({ onFile, onFindRoute }) {
  const el = document.getElementById('sidebar')
  el.className = 'sidebar'

  // Initial render
  renderSidebar(el, onFile, onFindRoute, store.state)

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    renderSidebar(el, onFile, onFindRoute, state)
  })
}

function renderSidebar(el, onFile, onFindRoute, state) {
  if (state.phase === 'IDLE') {
    el.innerHTML = `
      <div class="upload-page">
        <div class="upload-page-title">Fix broken GPS segments</div>
        <div class="upload-page-sub">Upload your .fit or .gpx activity file to get started</div>
        <div class="upload-zone upload-zone-large" id="upload-zone">
          <div class="upload-icon-large">📂</div>
          <div class="upload-cta">Drop file here or <span class="upload-link">browse</span></div>
          <div class="upload-formats">.fit · .gpx · max 50 MB</div>
          <input type="file" id="file-input" accept=".fit,.gpx" style="display:none" />
        </div>
      </div>
    `
    _bindUpload(el, onFile)
    return
  }

  if ((state.phase === 'LOADED' || state.phase === 'SELECTING') && state.track) {
    const t = state.track
    const totalDist = t.points[t.points.length - 1]?.distance ?? 0
    const startPt = t.points[0]
    const endPt = t.points[t.points.length - 1]
    const fmt = v => v.toFixed(4)
    const startTs = startPt?.timestamp ? new Date(startPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''
    const endTs = endPt?.timestamp ? new Date(endPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''

    el.innerHTML = `
      <div class="sidebar-section border-b">
        <div class="sidebar-label">Activity</div>
        <div class="track-meta">
          <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(totalDist / 1000).toFixed(1)} km</span></div>
          <div class="track-meta-row"><span class="track-meta-key">Type</span><span class="track-meta-val">${t.activityType}</span></div>
          <div class="track-meta-row"><span class="track-meta-key">Points</span><span class="track-meta-val">${t.points.length}</span></div>
          <div class="track-meta-row"><span class="track-meta-key">Gaps</span><span class="track-meta-val ${t.gaps.length > 0 ? 'val-broken' : 'val-ok'}">${t.gaps.length}</span></div>
        </div>
        <div class="track-endpoints">
          <div class="track-ep"><span class="track-ep-label">Start</span><span class="track-ep-coord">${fmt(startPt.lat)}, ${fmt(startPt.lng)}</span>${startTs ? `<span class="track-ep-time">${startTs}</span>` : ''}</div>
          <div class="track-ep-arrow">↓</div>
          <div class="track-ep"><span class="track-ep-label">End</span><span class="track-ep-coord">${fmt(endPt.lat)}, ${fmt(endPt.lng)}</span>${endTs ? `<span class="track-ep-time">${endTs}</span>` : ''}</div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Broken Segment</div>
        ${t.gaps.length > 0 ? `
          <div class="gap-hint" style="margin-bottom:12px">
            <span class="gap-hint-icon">⚠</span>
            ${t.gaps.length} gap${t.gaps.length > 1 ? 's' : ''} detected — red dashed on map
          </div>
        ` : ''}
        <div class="coord-field">
          <label class="coord-label">Start point</label>
          <input class="coord-input" id="coord-start" type="text" placeholder="48.2100, 16.3700" value="${state.segmentStart !== null ? `${fmt(t.points[state.segmentStart].lat)}, ${fmt(t.points[state.segmentStart].lng)}` : ''}" />
          <div class="coord-hint" id="coord-start-hint">${state.segmentStart !== null ? `Snapped to point ${state.segmentStart}` : 'Or click on map'}</div>
        </div>
        <div class="coord-field">
          <label class="coord-label">End point</label>
          <input class="coord-input" id="coord-end" type="text" placeholder="48.2200, 16.3850" value="${state.segmentEnd !== null ? `${fmt(t.points[state.segmentEnd].lat)}, ${fmt(t.points[state.segmentEnd].lng)}` : ''}" />
          <div class="coord-hint" id="coord-end-hint">${state.segmentEnd !== null ? `Snapped to point ${state.segmentEnd}` : 'Or click on map'}</div>
        </div>
        <button class="btn btn-primary" id="btn-find-route" style="width:100%;margin-top:10px" ${state.segmentStart === null || state.segmentEnd === null ? 'disabled' : ''}>Find Route →</button>
        ${t.gaps.length === 0 ? '<div class="no-gaps-msg" style="margin-top:8px">No gaps detected — track looks clean</div>' : ''}
      </div>
    `

    // Wire coord inputs — parse lat,lng and snap to nearest track point
    function parseCoord(str) {
      const m = str.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/)
      if (!m) return null
      return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
    }
    function nearestIdx(lat, lng) {
      let minD = Infinity, minI = 0
      t.points.forEach((p, i) => {
        const d = Math.hypot(p.lat - lat, p.lng - lng)
        if (d < minD) { minD = d; minI = i }
      })
      return minI
    }
    function updateBtn() {
      const btn = el.querySelector('#btn-find-route')
      if (btn) btn.disabled = store.state.segmentStart === null || store.state.segmentEnd === null
    }

    el.querySelector('#coord-start')?.addEventListener('input', e => {
      const c = parseCoord(e.target.value)
      if (!c) { el.querySelector('#coord-start-hint').textContent = 'Invalid — use: lat, lng'; return }
      const idx = nearestIdx(c.lat, c.lng)
      el.querySelector('#coord-start-hint').textContent = `Snapped to point ${idx}`
      store.setState({ segmentStart: idx })
      updateBtn()
    })
    el.querySelector('#coord-end')?.addEventListener('input', e => {
      const c = parseCoord(e.target.value)
      if (!c) { el.querySelector('#coord-end-hint').textContent = 'Invalid — use: lat, lng'; return }
      const idx = nearestIdx(c.lat, c.lng)
      el.querySelector('#coord-end-hint').textContent = `Snapped to point ${idx}`
      store.setState({ segmentEnd: idx })
      updateBtn()
    })
    el.querySelector('#btn-find-route')?.addEventListener('click', () => {
      const { segmentStart, segmentEnd } = store.state
      if (segmentStart !== null && segmentEnd !== null) {
        onFindRoute(segmentStart, segmentEnd)
      }
    })
    return
  }

  if (state.phase === 'FIXING') {
    el.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-label">Finding Routes</div>
        <div style="display:flex;align-items:center;gap:10px;padding:16px 0">
          <div class="spinner"></div>
          <div style="font-size:12px;color:var(--text-3)">Querying OSRM…</div>
        </div>
      </div>
    `
    return
  }

  if (state.phase === 'FIXED' || state.phase === 'EXPORTED') {
    const t = state.track
    const totalDist = t.points[t.points.length - 1]?.distance ?? 0
    el.innerHTML = `
      <div class="sidebar-section border-b">
        <div class="sidebar-label">Activity</div>
        <div class="track-meta">
          <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(totalDist / 1000).toFixed(1)} km</span></div>
          <div class="track-meta-row"><span class="track-meta-key">Type</span><span class="track-meta-val">${t.activityType}</span></div>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Route Options</div>
        <div style="font-size:12px;color:var(--text-3);padding:8px 0">Choose a route in the panel → apply fix → download.</div>
        <button class="btn btn-ghost" id="btn-reselect" style="margin-top:8px;width:100%">← Reselect segment</button>
      </div>
    `
    document.getElementById('btn-reselect')?.addEventListener('click', () => {
      store.setState({ phase: 'LOADED', segmentStart: null, segmentEnd: null, suggestions: [], chosenRoute: null })
    })
    return
  }

  el.innerHTML = ''
}

function _bindUpload(el, onFile) {
  const zone = el.querySelector('#upload-zone')
  const input = el.querySelector('#file-input')
  if (!zone || !input) return

  zone.addEventListener('click', () => input.click())
  input.addEventListener('change', e => { if (e.target.files[0]) onFile(e.target.files[0]) })
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over') })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('drag-over')
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  })
}

export function recordRecentActivity(track, filename) {
  const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')
  const totalDist = track.points[track.points.length - 1]?.distance ?? 0
  const ts = track.points[0]?.timestamp
  const date = ts ? new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''
  const name = filename.replace(/\.(fit|gpx)$/i, '').replace(/[<>"'&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]))
  stored.unshift({ name, activityType: track.activityType, date, distance: totalDist, gaps: track.gaps.length })
  sessionStorage.setItem('recentActivities', JSON.stringify(stored.slice(0, 10)))
}
