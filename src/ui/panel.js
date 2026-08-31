// src/ui/panel.js
import { store } from '../store.js'

let _unsubscribe = null

export function initPanel({ onChoose, onDownload }) {
  const el = document.getElementById('right-panel')
  el.className = 'right-panel'

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    if (state.phase === 'IDLE' || state.phase === 'LOADED') {
      el.innerHTML = ''
      return
    }
    if (state.phase === 'SEGMENT_SELECTED' || state.phase === 'FIXING') {
      el.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">Route Suggestions</div>
            <div class="panel-subtitle">Fetching routes…</div>
          </div>
        </div>
      `
      return
    }
    if (state.phase === 'ROUTE_CHOSEN' || state.phase === 'EXPORTED') {
      const gapDist = (state.track.points[state.segmentEnd]?.distance ?? 0) - (state.track.points[state.segmentStart]?.distance ?? 0)
      const tStart = state.track.points[state.segmentStart]?.timestamp ?? 0
      const tEnd = state.track.points[state.segmentEnd]?.timestamp ?? 0
      const gapMin = Math.round((tEnd - tStart) / 60000)

      el.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">Route Suggestions</div>
            <div class="panel-subtitle">${state.suggestions.length} routes found · gap: ${(gapDist / 1000).toFixed(1)}km</div>
          </div>
        </div>
        <div class="segment-info">
          <div class="seg-stat"><div class="seg-stat-label">Gap Distance</div><div class="seg-stat-val bad">${(gapDist / 1000).toFixed(1)} km</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Duration</div><div class="seg-stat-val bad">~${gapMin} min</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Surface</div><div class="seg-stat-val">Road</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Type</div><div class="seg-stat-val">${state.track.activityType}</div></div>
        </div>
        <div class="suggestions-list">
          ${state.suggestions.map((s, i) => `
            <div class="suggestion-card ${state.chosenRoute === s.route ? 'selected' : ''}" data-idx="${i}">
              <div class="suggestion-body">
                <div class="suggestion-name">
                  ${s.label}
                  ${i === 0 ? '<span class="suggestion-tag tag-recommended">Recommended</span>' : ''}
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
          <div class="action-row">
            <button class="btn btn-ghost" id="btn-back">← Back</button>
            <button class="btn btn-primary" id="btn-apply-fix" ${!state.chosenRoute ? 'disabled' : ''}>Apply Fix</button>
          </div>
          <button class="btn btn-success" id="btn-download" ${state.phase !== 'EXPORTED' ? 'disabled' : ''} style="${state.phase !== 'EXPORTED' ? 'opacity:0.5' : ''}">Download .fit</button>
        </div>
      `

      el.querySelectorAll('.suggestion-card[data-idx]').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.idx)
          onChoose(state.suggestions[idx])
        })
      })

      document.getElementById('btn-back')?.addEventListener('click', () =>
        store.setState({ phase: 'LOADED', segmentStart: null, segmentEnd: null, suggestions: [], chosenRoute: null })
      )
      document.getElementById('btn-apply-fix')?.addEventListener('click', () =>
        store.setState({ phase: 'EXPORTED' })
      )
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
