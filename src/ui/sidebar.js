// src/ui/sidebar.js
import { store } from '../store.js'

let _unsubscribe = null

export function initSidebar({ onFile }) {
  const el = document.getElementById('sidebar')
  el.className = 'sidebar'

  el.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-label">Load Activity</div>
      <div class="upload-zone" id="upload-zone">
        <div class="upload-icon">📂</div>
        <div class="upload-text">Drop <strong>.fit</strong> or <strong>.gpx</strong> here<br>or click to browse</div>
        <input type="file" id="file-input" accept=".fit,.gpx" style="display:none" />
      </div>
    </div>
    <div id="activity-list" class="activity-list"></div>
  `

  const zone = document.getElementById('upload-zone')
  const input = document.getElementById('file-input')

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

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    const list = document.getElementById('activity-list')
    if (!list) return
    const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')

    if (state.phase === 'LOADED' && state.track) {
      const t = state.track
      const totalDist = t.points[t.points.length - 1]?.distance ?? 0
      const gapCount = t.gaps.length
      const startPt = t.points[0]
      const endPt = t.points[t.points.length - 1]
      const fmt = (v) => v.toFixed(4)
      const startTs = startPt?.timestamp ? new Date(startPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''
      const endTs = endPt?.timestamp ? new Date(endPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''
      list.innerHTML = `
        <div class="select-prompt">
          <div class="select-prompt-title">${gapCount > 0 ? `${gapCount} broken segment${gapCount > 1 ? 's' : ''} detected` : 'Route loaded'}</div>
          <div class="select-prompt-dist">${(totalDist / 1000).toFixed(1)} km · ${t.activityType}</div>
          <div class="track-endpoints">
            <div class="track-ep"><span class="track-ep-label">Start</span><span class="track-ep-coord">${fmt(startPt.lat)}, ${fmt(startPt.lng)}</span>${startTs ? `<span class="track-ep-time">${startTs}</span>` : ''}</div>
            <div class="track-ep-arrow">↓</div>
            <div class="track-ep"><span class="track-ep-label">End</span><span class="track-ep-coord">${fmt(endPt.lat)}, ${fmt(endPt.lng)}</span>${endTs ? `<span class="track-ep-time">${endTs}</span>` : ''}</div>
          </div>
          <div class="select-prompt-steps">
            <div class="select-step"><span class="select-step-badge">1</span>Click on the map to set the <strong>start</strong> of the broken segment</div>
            <div class="select-step"><span class="select-step-badge">2</span>Click again to set the <strong>end</strong> of the broken segment</div>
            <div class="select-step"><span class="select-step-badge">3</span>We'll find road-snapped routes to fix it</div>
          </div>
        </div>
        ${stored.length ? `
          <div class="sidebar-label" style="padding: 10px 16px 4px;">Recent</div>
          ${stored.map((a, i) => `
            <div class="activity-item ${i === 0 ? 'active' : ''}">
              <div class="act-icon">${a.activityType === 'running' ? '🏃' : '🚴'}</div>
              <div class="act-meta">
                <div class="act-name">${a.name}</div>
                <div class="act-detail">${a.date} · ${(a.distance / 1000).toFixed(1)}km</div>
              </div>
              <span class="badge ${a.gaps > 0 ? 'badge-broken' : 'badge-fixed'}">${a.gaps > 0 ? 'Broken' : 'Fixed'}</span>
            </div>
          `).join('')}
        ` : ''}
      `
      return
    }

    list.innerHTML = stored.length ? `
      <div class="sidebar-label" style="padding: 10px 16px 4px;">Recent</div>
      ${stored.map((a, i) => `
        <div class="activity-item ${i === 0 && state.phase !== 'IDLE' ? 'active' : ''}">
          <div class="act-icon">${a.activityType === 'running' ? '🏃' : '🚴'}</div>
          <div class="act-meta">
            <div class="act-name">${a.name}</div>
            <div class="act-detail">${a.date} · ${(a.distance / 1000).toFixed(1)}km</div>
          </div>
          <span class="badge ${a.gaps > 0 ? 'badge-broken' : 'badge-fixed'}">${a.gaps > 0 ? 'Broken' : 'Fixed'}</span>
        </div>
      `).join('')}
    ` : ''
  })
}

export function recordRecentActivity(track, filename) {
  const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')
  const totalDist = track.points[track.points.length - 1]?.distance ?? 0
  const ts = track.points[0]?.timestamp
  const date = ts ? new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''
  const name = filename.replace(/\.(fit|gpx)$/i, '').replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]))
  stored.unshift({ name, activityType: track.activityType, date, distance: totalDist, gaps: track.gaps.length })
  sessionStorage.setItem('recentActivities', JSON.stringify(stored.slice(0, 10)))
}
