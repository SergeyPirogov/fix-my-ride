// src/ui/mobile-tabs.js
// Below the mobile breakpoint, #sidebar / #map-column / #right-panel are
// shown one at a time via a tab bar instead of the desktop's 3-column
// layout. Above the breakpoint the tab bar is hidden by CSS and all three
// panels show simultaneously regardless of which "tab" is marked active.

const PANEL_IDS = ['sidebar', 'map-column', 'right-panel']

export function initMobileTabs() {
  const bar = document.getElementById('mobile-tabs')
  if (!bar) return

  function activate(tabName) {
    bar.querySelectorAll('.mobile-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName)
    })
    PANEL_IDS.forEach(id => {
      document.getElementById(id)?.classList.toggle('mobile-panel-active', id === tabName)
    })
    // The map needs a fresh size read whenever it becomes visible again —
    // Leaflet can't measure a display:none container.
    if (tabName === 'map-column') {
      window.dispatchEvent(new CustomEvent('mobile-tab-map-shown'))
    }
  }

  bar.querySelectorAll('.mobile-tab').forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab))
  })

  activate('sidebar')

  return { activate }
}
