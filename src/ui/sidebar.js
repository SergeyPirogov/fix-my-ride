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

    if (state.phase === 'LOADED' && state.track) {
      const t = state.track
      const totalDist = t.points[t.points.length - 1]?.distance ?? 0
      const startPt = t.points[0]
      const endPt = t.points[t.points.length - 1]
      const fmt = v => v.toFixed(4)
      const startTs = startPt?.timestamp ? new Date(startPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''
      const endTs = endPt?.timestamp ? new Date(endPt.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''
      list.innerHTML = `
        <div class="select-prompt">
          <div class="select-prompt-title">${t.gaps.length > 0 ? `${t.gaps.length} broken segment${t.gaps.length > 1 ? 's' : ''} detected` : 'Route loaded — no gaps'}</div>
          <div class="select-prompt-dist">${(totalDist / 1000).toFixed(1)} km · ${t.activityType}</div>
          <div class="track-endpoints">
            <div class="track-ep"><span class="track-ep-label">Start</span><span class="track-ep-coord">${fmt(startPt.lat)}, ${fmt(startPt.lng)}</span>${startTs ? `<span class="track-ep-time">${startTs}</span>` : ''}</div>
            <div class="track-ep-arrow">↓</div>
            <div class="track-ep"><span class="track-ep-label">End</span><span class="track-ep-coord">${fmt(endPt.lat)}, ${fmt(endPt.lng)}</span>${endTs ? `<span class="track-ep-time">${endTs}</span>` : ''}</div>
          </div>
          ${t.gaps.length > 0 ? `<div class="auto-fix-hint">Fixing routes automatically…</div>` : ''}
        </div>
      `
      return
    }

    if (state.phase === 'AUTO_FIXING' && state.track) {
      const t = state.track
      const totalDist = t.points[t.points.length - 1]?.distance ?? 0
      list.innerHTML = `
        <div class="select-prompt">
          <div class="select-prompt-title">Fixing ${t.gaps.length} segment${t.gaps.length > 1 ? 's' : ''}…</div>
          <div class="select-prompt-dist">${(totalDist / 1000).toFixed(1)} km · ${t.activityType}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:0 2px">
            <div class="spinner"></div>
            <div style="font-size:12px;color:var(--text-3)">Querying road routes…</div>
          </div>
        </div>
      `
      return
    }

    if ((state.phase === 'FIXED' || state.phase === 'EXPORTED') && state.track) {
      const t = state.track
      const totalDist = t.points[t.points.length - 1]?.distance ?? 0
      const okCount = state.fixes.filter(f => f.status === 'ok' || f.status === 'manual').length
      const failCount = state.fixes.filter(f => f.status === 'failed').length
      list.innerHTML = `
        <div class="select-prompt">
          <div class="select-prompt-title">${okCount} fixed${failCount > 0 ? ` · ${failCount} failed` : ''}</div>
          <div class="select-prompt-dist">${(totalDist / 1000).toFixed(1)} km · ${t.activityType}</div>
        </div>
        <div class="gap-list">
          ${state.fixes.map((fix, i) => {
            const startPt = t.points[fix.startIdx]
            const endPt = t.points[fix.endIdx]
            const gapDist = ((endPt.distance - startPt.distance) / 1000).toFixed(1)
            const statusLabel = fix.status === 'ok' ? 'Fixed' : fix.status === 'manual' ? 'Manual' : 'Failed'
            const statusClass = fix.status === 'ok' ? 'badge-fixed' : fix.status === 'manual' ? 'badge-manual' : 'badge-broken'
            const isActive = state.activeGapIdx === fix.gapIdx
            return `
              <div class="gap-item ${isActive ? 'gap-item-active' : ''}" data-gap="${fix.gapIdx}">
                <div class="gap-item-header">
                  <span class="gap-item-label">Gap ${i + 1}</span>
                  <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="gap-item-dist">${gapDist} km gap</div>
                <button class="btn btn-ghost btn-sm gap-redraw-btn" data-gap="${fix.gapIdx}">Redraw</button>
              </div>
            `
          }).join('')}
        </div>
      `
      list.querySelectorAll('.gap-redraw-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation()
          const gapIdx = parseInt(btn.dataset.gap)
          store.setState({ activeGapIdx: gapIdx })
        })
      })
      list.querySelectorAll('.gap-item').forEach(item => {
        item.addEventListener('click', () => {
          const gapIdx = parseInt(item.dataset.gap)
          store.setState({ activeGapIdx: state.activeGapIdx === gapIdx ? null : gapIdx })
        })
      })
      return
    }

    list.innerHTML = ''
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
