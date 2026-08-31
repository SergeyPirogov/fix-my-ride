// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderTrack, clearTrack } from './map/track-layer.js'
import { initSelection } from './map/selection.js'
// TODO: import { fetchSuggestions } from './routing/suggestions.js'  // will be created in Task 7

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'fit' && ext !== 'gpx') {
    showToast('Only .fit and .gpx files are supported')
    return
  }
  try {
    let track
    if (ext === 'fit') {
      const buf = await file.arrayBuffer()
      track = await parseFit(buf)
    } else {
      const text = await file.text()
      track = parseGpx(text)
    }
    recordRecentActivity(track, file.name)
    store.setState({ phase: 'LOADED', track })
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
  }
}

const map = initMap()

initTopbar()
initSidebar({ onFile: handleFile })
initPanel({ onChoose: () => {}, onDownload: () => {} })

initSelection(map, {
  onSegmentChange: async (startIdx, endIdx) => {
    store.setState({ phase: 'SEGMENT_SELECTED', segmentStart: startIdx, segmentEnd: endIdx })
    // Task 7 will wire fetchSuggestions here
  }
})

store.subscribe(state => {
  if (state.phase === 'IDLE') { clearTrack(map); return }
  if (state.track) renderTrack(map, state.track)
})
