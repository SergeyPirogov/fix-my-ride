// src/ui/topbar.js
import { store } from '../store.js'

let _unsubscribe = null

const STEPS = ['Load', 'Select', 'Fix', 'Export']
const PHASE_STEP = {
  IDLE: 0, LOADED: 1, SEGMENT_SELECTED: 1,
  FIXING: 2, ROUTE_CHOSEN: 2, EXPORTED: 3,
}

export function initTopbar() {
  const el = document.getElementById('topbar')
  el.className = 'topbar'

  function render(state) {
    const current = PHASE_STEP[state.phase] ?? 0
    el.innerHTML = `
      <div class="logo">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 4 L9 9 L13 11" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9" cy="9" r="1.5" fill="var(--accent)"/>
        </svg>
        FIX MY RIDE
      </div>
      <div class="topbar-sep"></div>
      <div class="step-indicator">
        ${STEPS.map((s, i) => {
          const cls = i < current ? 'done' : i === current ? 'active' : ''
          const num = i < current ? '✓' : i + 1
          return `
            ${i > 0 ? '<span class="step-arrow">›</span>' : ''}
            <div class="step ${cls}"><div class="step-num">${num}</div>${s}</div>
          `
        }).join('')}
      </div>
      <div class="topbar-actions">
        <button class="theme-toggle" id="theme-toggle">◐</button>
        ${state.phase !== 'IDLE' ? '<button class="btn btn-ghost" id="btn-reset">Discard</button>' : ''}
        ${state.phase === 'ROUTE_CHOSEN' ? '<button class="btn btn-primary" id="btn-apply">Apply Fix</button>' : ''}
      </div>
    `
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const root = document.documentElement
      root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
    })
    document.getElementById('btn-reset')?.addEventListener('click', () => store.reset())
    document.getElementById('btn-apply')?.addEventListener('click', () =>
      store.setState({ phase: 'EXPORTED' })
    )
  }

  render(store.state)
  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(render)
}
