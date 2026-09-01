// src/ui/mobile-tabs.js
// Below the mobile breakpoint, #sidebar and the combined #map-column +
// #right-panel are shown one group at a time via a tab bar instead of the
// desktop's 3-column layout. Above the breakpoint the tab bar is hidden by
// CSS and all three panels show simultaneously regardless of which "tab"
// is marked active.

// Which panels a given tab shows — "map-column" brings #right-panel along
// with it so results appear stacked below the map instead of needing a
// separate tab.
const TAB_PANELS = {
  sidebar: ['sidebar'],
  'map-column': ['map-column', 'right-panel'],
}
const ALL_PANEL_IDS = ['sidebar', 'map-column', 'right-panel']

export function initMobileTabs() {
  const bar = document.getElementById('mobile-tabs')
  if (!bar) return

  function activate(tabName) {
    bar.querySelectorAll('.mobile-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName)
    })
    const shownIds = TAB_PANELS[tabName] ?? [tabName]
    ALL_PANEL_IDS.forEach(id => {
      document.getElementById(id)?.classList.toggle('mobile-panel-active', shownIds.includes(id))
    })
    // The map needs a fresh size read whenever it becomes visible again —
    // Leaflet can't measure a container that was just display:none.
    if (shownIds.includes('map-column')) {
      window.dispatchEvent(new CustomEvent('mobile-tab-map-shown'))
    }
  }

  bar.querySelectorAll('.mobile-tab').forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab))
  })

  activate('sidebar')

  return { activate }
}
