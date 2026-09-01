// src/ui/panel.js
import { store } from '../store.js'

let _unsubscribe = null

export function initPanel({ onDownload }) {
  const el = document.getElementById('right-panel')
  el.classList.add('right-panel')

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    if (state.phase !== 'FIXED' && state.phase !== 'EXPORTED') {
      el.innerHTML = ''
      return
    }

    const fixed = state.fixedPoints ?? []
    const orig = state.fitTrack?.points ?? []
    const pointCount = fixed.length
    const dist = (fixed[pointCount - 1]?.distance ?? 0) / 1000
    const origDist = (orig[orig.length - 1]?.distance ?? 0) / 1000

    const range = (arr, key) => {
      const vals = arr.map(p => p[key]).filter(v => v != null)
      if (vals.length === 0) return null
      return [Math.min(...vals), Math.max(...vals)]
    }
    const fmtRange = r => r ? `${r[0]}–${r[1]}` : '—'

    const origHr = range(orig, 'hr')
    const fixedHr = range(fixed, 'hr')
    const origPower = range(orig, 'power')
    const fixedPower = range(fixed, 'power')

    el.innerHTML = `
      <div class="panel-header">
        <div class="result-check">✓</div>
        <div>
          <div class="panel-title">Route fixed</div>
          <div class="panel-subtitle">${pointCount.toLocaleString()} points · ${dist.toFixed(1)} km</div>
        </div>
      </div>

      <div class="compare-table">
        <div class="compare-row compare-head">
          <div></div>
          <div class="compare-col compare-col-before">Before</div>
          <div class="compare-col compare-col-after">After</div>
        </div>
        <div class="compare-row">
          <div class="compare-key">Distance</div>
          <div class="compare-col compare-col-before">${origDist.toFixed(1)} km</div>
          <div class="compare-col compare-col-after">${dist.toFixed(1)} km</div>
        </div>
        <div class="compare-row">
          <div class="compare-key">Heart rate</div>
          <div class="compare-col compare-col-before">${fmtRange(origHr)}</div>
          <div class="compare-col compare-col-after">${fmtRange(fixedHr)}</div>
        </div>
        <div class="compare-row">
          <div class="compare-key">Power</div>
          <div class="compare-col compare-col-before">${fmtRange(origPower)}</div>
          <div class="compare-col compare-col-after">${fmtRange(fixedPower)}</div>
        </div>
      </div>

      <div class="result-legend">
        <div class="legend-item"><span class="legend-dot legend-dot-gpx"></span>GPX reference (dashed)</div>
        <div class="legend-item"><span class="legend-dot legend-dot-fixed"></span>Fixed route</div>
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
