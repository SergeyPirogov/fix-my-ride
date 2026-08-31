// src/ui/panel.js
import { store } from '../store.js'

let _unsubscribe = null

export function initPanel({ onChooseRoute, onDrawGap, onDownload }) {
  const el = document.getElementById('right-panel')
  el.className = 'right-panel'

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    if (state.phase === 'IDLE' || state.phase === 'LOADED' || state.phase === 'AUTO_FIXING') {
      el.innerHTML = ''
      return
    }

    if (state.phase === 'FIXED' || state.phase === 'EXPORTED') {
      const okCount = state.fixes.filter(f => f.status === 'ok' || f.status === 'manual').length
      const failCount = state.fixes.filter(f => f.status === 'failed').length

      // If a gap is active, show its detail
      if (state.activeGapIdx !== null) {
        const fix = state.fixes.find(f => f.gapIdx === state.activeGapIdx)
        if (!fix) { el.innerHTML = ''; return }

        const startPt = state.track.points[fix.startIdx]
        const endPt = state.track.points[fix.endIdx]
        const gapDist = endPt.distance - startPt.distance
        const gapMin = Math.round((endPt.timestamp - startPt.timestamp) / 60000)
        const gapIdx = state.fixes.indexOf(fix)

        el.innerHTML = `
          <div class="panel-header">
            <div>
              <div class="panel-title">Gap ${gapIdx + 1} of ${state.fixes.length}</div>
              <div class="panel-subtitle">${(gapDist / 1000).toFixed(1)} km · ~${gapMin} min</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-gap">✕</button>
          </div>
          <div class="segment-info">
            <div class="seg-stat"><div class="seg-stat-label">Gap Distance</div><div class="seg-stat-val bad">${(gapDist / 1000).toFixed(1)} km</div></div>
            <div class="seg-stat"><div class="seg-stat-label">Duration</div><div class="seg-stat-val bad">~${gapMin} min</div></div>
            <div class="seg-stat"><div class="seg-stat-label">Status</div><div class="seg-stat-val" style="color:${fix.status === 'failed' ? 'var(--broken)' : 'var(--success)'}">${fix.status === 'ok' ? 'Fixed' : fix.status === 'manual' ? 'Manual' : 'Failed'}</div></div>
            <div class="seg-stat"><div class="seg-stat-label">Type</div><div class="seg-stat-val">${state.track.activityType}</div></div>
          </div>
          <div class="suggestions-list">
            ${fix.suggestions.map((s, i) => `
              <div class="suggestion-card ${fix.route === s.route ? 'selected' : ''}" data-sug="${i}">
                <div class="suggestion-body">
                  <div class="suggestion-name">
                    ${s.label}
                    ${i === 0 ? '<span class="suggestion-tag tag-recommended">Best</span>' : ''}
                  </div>
                  <div class="suggestion-stats">
                    <div class="sug-stat"><div class="sug-stat-label">Distance</div><div class="sug-stat-val">${(s.distance / 1000).toFixed(2)} km</div></div>
                    <div class="sug-stat"><div class="sug-stat-label">Match</div><div class="sug-stat-val" style="color:${s.matchScore > 0.85 ? 'var(--success)' : 'var(--warning)'}">${Math.round(s.matchScore * 100)}%</div></div>
                  </div>
                </div>
              </div>
            `).join('')}
            <div class="suggestion-card" id="manual-draw-card">
              <div class="suggestion-body">
                <div class="suggestion-name">Draw Manually <span class="suggestion-tag tag-manual">Custom</span></div>
                <div style="font-size:12px;color:var(--text-2);margin-top:4px">Click waypoints on the map to build your own route.</div>
              </div>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn btn-success" id="btn-download" ${state.phase !== 'EXPORTED' ? 'disabled' : ''} style="${state.phase !== 'EXPORTED' ? 'opacity:0.5' : ''}">Download .fit</button>
          </div>
        `

        el.querySelectorAll('.suggestion-card[data-sug]').forEach(card => {
          card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.sug)
            onChooseRoute(fix.gapIdx, fix.suggestions[idx])
          })
        })
        document.getElementById('manual-draw-card')?.addEventListener('click', () => onDrawGap(fix.gapIdx))
        document.getElementById('btn-close-gap')?.addEventListener('click', () => store.setState({ activeGapIdx: null }))
        document.getElementById('btn-download')?.addEventListener('click', () => onDownload())
        return
      }

      // No active gap — show summary + download
      el.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">All gaps processed</div>
            <div class="panel-subtitle">${okCount} fixed${failCount > 0 ? ` · ${failCount} need attention` : ''}</div>
          </div>
        </div>
        ${failCount > 0 ? `
          <div style="padding:12px 16px;background:var(--warning-subtle);border-bottom:1px solid var(--warning-border);font-size:12px;color:var(--warning-text)">
            ${failCount} gap${failCount > 1 ? 's' : ''} could not be auto-routed. Click them in the left panel to draw manually.
          </div>
        ` : ''}
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center">
          <div style="font-size:32px">✓</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-1)">Track ready</div>
          <div style="font-size:12px;color:var(--text-3)">Click a gap in the left panel to review or redraw it.</div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-success" id="btn-download">Download .fit</button>
        </div>
      `
      document.getElementById('btn-download')?.addEventListener('click', () => onDownload())
    }
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
