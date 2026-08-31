// src/ui/panel.js
import { store } from '../store.js'

let _unsubscribe = null

export function initPanel({ onDownload }) {
  const el = document.getElementById('right-panel')
  el.className = 'right-panel'

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    if (state.phase !== 'FIXED' && state.phase !== 'EXPORTED') {
      el.innerHTML = ''
      return
    }

    const okCount = state.fixes.filter(f => f.status === 'ok').length
    const failCount = state.fixes.filter(f => f.status === 'failed').length

    el.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-title">Fix Result</div>
          <div class="panel-subtitle">${okCount} matched${failCount > 0 ? ` · ${failCount} unmatched` : ''}</div>
        </div>
      </div>
      ${failCount > 0 ? `
        <div style="padding:12px 16px;background:var(--warning-subtle);border-bottom:1px solid var(--warning-border);font-size:12px;color:var(--warning-text)">
          ${failCount} gap${failCount > 1 ? 's' : ''} had no matching GPX segment nearby — shown as an orange dashed line on the map.
        </div>
      ` : ''}
      <div class="fix-list">
        ${state.fixes.map((fix, i) => {
          const s = state.fitTrack.points[fix.startIdx]
          const e = state.fitTrack.points[fix.endIdx]
          const gapDist = ((e.distance - s.distance) / 1000).toFixed(2)
          return `
            <div class="fix-item">
              <div class="fix-item-header">
                <span class="fix-item-label">Gap ${i + 1}</span>
                <span class="badge ${fix.status === 'ok' ? 'badge-fixed' : 'badge-broken'}">${fix.status === 'ok' ? 'Matched' : 'Unmatched'}</span>
              </div>
              <div class="fix-item-dist">${gapDist} km</div>
            </div>
          `
        }).join('')}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center">
        <div style="font-size:32px">${failCount === 0 ? '✓' : '⚠'}</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-1)">${failCount === 0 ? 'Track ready' : 'Review unmatched gaps'}</div>
        <div style="font-size:12px;color:var(--text-3)">Green = matched from GPX · Orange dashed = unmatched</div>
      </div>
      <div class="panel-actions">
        <button class="btn btn-success" id="btn-download">Download .fit</button>
      </div>
    `
    document.getElementById('btn-download')?.addEventListener('click', () => onDownload())
  })
}

export function showToast(message, type = 'error') {
  const existing = document.getElementById('toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = 'toast'
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}
