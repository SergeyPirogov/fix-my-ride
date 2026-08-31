// src/ui/sidebar.js
import { store } from '../store.js'

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

  store.subscribe(state => {
    const list = document.getElementById('activity-list')
    if (!list) return
    const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')
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
  stored.unshift({ name: filename.replace(/\.(fit|gpx)$/i, ''), activityType: track.activityType, date, distance: totalDist, gaps: track.gaps.length })
  sessionStorage.setItem('recentActivities', JSON.stringify(stored.slice(0, 10)))
}
