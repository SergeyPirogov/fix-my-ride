// src/ui/sidebar.js
import { store } from '../store.js'

let _unsubscribe = null

export function initSidebar({ onFile }) {
  const el = document.getElementById('sidebar')
  el.className = 'sidebar'

  // Initial render
  renderSidebar(el, onFile, store.state)

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    renderSidebar(el, onFile, state)
  })
}

function renderSidebar(el, onFile, state) {
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
      ${t.gaps.length > 0 ? `
        <div class="sidebar-section">
          <div class="sidebar-label">Select Broken Segment</div>
          <div class="instruction-steps">
            <div class="instruction-step ${state.segmentStart === null ? 'step-active' : 'step-done'}">
              <div class="step-dot">${state.segmentStart !== null ? '✓' : '1'}</div>
              <div class="step-text">Click on map — set <strong>start</strong> of broken segment</div>
            </div>
            <div class="instruction-step ${state.segmentStart !== null && state.segmentEnd === null ? 'step-active' : state.segmentEnd !== null ? 'step-done' : ''}">
              <div class="step-dot">${state.segmentEnd !== null ? '✓' : '2'}</div>
              <div class="step-text">Click again — set <strong>end</strong> of broken segment</div>
            </div>
            <div class="instruction-step">
              <div class="step-dot">3</div>
              <div class="step-text">We find road-snapped routes</div>
            </div>
          </div>
          ${t.gaps.length > 0 ? `
            <div class="gap-hint">
              <span class="gap-hint-icon">⚠</span>
              ${t.gaps.length} broken segment${t.gaps.length > 1 ? 's' : ''} detected — red dashed lines on map
            </div>
          ` : ''}
        </div>
      ` : `
        <div class="sidebar-section">
          <div class="no-gaps-msg">No gaps detected. Track looks clean!</div>
        </div>
      `}
    `
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
