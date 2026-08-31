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

    const pointCount = state.fixedPoints?.length ?? 0
    const dist = ((state.fixedPoints?.[pointCount - 1]?.distance ?? 0) / 1000).toFixed(1)

    el.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-title">Fix Result</div>
          <div class="panel-subtitle">${pointCount} points · ${dist} km</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center">
        <div style="font-size:32px">✓</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-1)">Route replaced with GPX path</div>
        <div style="font-size:12px;color:var(--text-3)">Timing, HR, power and cadence carried over from your original ride</div>
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
